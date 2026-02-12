import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createApprovalRule,
  getApprovalRules,
  initiateApproval,
  processApprovalDecision,
  getApprovals,
  getPendingApprovalsForUser,
} from "@/lib/finance/approvals";

const approvalRuleCreateSchema = z.object({
  tenantSlug: z.string().min(1),
  entityType: z.enum(["purchase_order", "bill", "payment"]),
  ruleType: z.enum(["amount_based", "department_based", "project_based", "vendor_based"]),
  conditions: z.record(z.any()),
  approvers: z.array(z.object({
    step: z.number().positive(),
    userId: z.string().uuid(),
    role: z.string().optional(),
    required: z.boolean(),
    order: z.number().nonnegative(),
  })),
  priority: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

const approvalInitiateSchema = z.object({
  tenantSlug: z.string().min(1),
  entityType: z.enum(["purchase_order", "bill", "payment"]),
  entityId: z.string().uuid(),
  requestedBy: z.string().uuid(),
  entityData: z.record(z.any()),
});

const approvalDecisionSchema = z.object({
  userId: z.string().uuid(),
  decision: z.enum(["approved", "rejected", "escalated"]),
  comments: z.string().optional(),
});

const approvalListSchema = z.object({
  tenantSlug: z.string().min(1),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  status: z.string().optional(),
  userId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
  offset: z.coerce.number().min(0).optional(),
});

export async function GET(request: NextRequest) {
  console.log('API: GET /api/finance/approvals called');
  
  try {
    const url = new URL(request.url);
    
    // Get approval rules
    if (url.searchParams.get("rules") === "true") {
      const tenantSlug = url.searchParams.get("tenantSlug");
      const entityType = url.searchParams.get("entityType");
      const isActive = url.searchParams.get("isActive");
      
      if (!tenantSlug) {
        return NextResponse.json(
          { error: "tenantSlug parameter required" },
          { status: 400 }
        );
      }
      
      const rules = await getApprovalRules({
        tenantSlug,
        entityType: entityType || undefined,
        isActive: isActive !== null ? isActive === "true" : undefined
      });
      
      return NextResponse.json({ rules });
    }

    // Get pending approvals for user
    if (url.searchParams.get("pending") === "true") {
      const tenantSlug = url.searchParams.get("tenantSlug");
      const userId = url.searchParams.get("userId");
      
      if (!tenantSlug || !userId) {
        return NextResponse.json(
          { error: "tenantSlug and userId parameters required" },
          { status: 400 }
        );
      }
      
      const approvals = await getPendingApprovalsForUser(tenantSlug, userId);
      return NextResponse.json({ approvals });
    }

    // Get single approval by ID
    if (url.searchParams.get("id")) {
      const approvalId = url.searchParams.get("id")!;
      const approvals = await getApprovals({
        tenantSlug: "", // Will be filtered by ID in the service
        entityId: approvalId
      });
      
      if (!approvals.length) {
        return NextResponse.json(
          { error: "Approval not found" },
          { status: 404 }
        );
      }
      
      return NextResponse.json({ approval: approvals[0] });
    }

    // List approvals with filters
    const parsed = approvalListSchema.safeParse({
      tenantSlug: url.searchParams.get("tenantSlug"),
      entityType: url.searchParams.get("entityType"),
      entityId: url.searchParams.get("entityId"),
      status: url.searchParams.get("status"),
      userId: url.searchParams.get("userId"),
      limit: url.searchParams.get("limit"),
      offset: url.searchParams.get("offset"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const approvals = await getApprovals(parsed.data);
    return NextResponse.json({ approvals });

  } catch (error) {
    console.error("Approvals GET error:", (error as any)?.stack || error);
    return NextResponse.json(
      { error: "Internal server error", details: String((error as any)?.message ?? error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('API: POST /api/finance/approvals called');
  
  try {
    const body = await request.json();
    
    // Create approval rule
    if (body.action === "create-rule") {
      const parsed = approvalRuleCreateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid rule data", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const rule = await createApprovalRule(parsed.data);
      return NextResponse.json({ rule }, { status: 201 });
    }

    // Process approval decision
    if (body.action === "decision") {
      const approvalId = body.approvalId;
      if (!approvalId) {
        return NextResponse.json(
          { error: "approvalId required for decision" },
          { status: 400 }
        );
      }

      const parsed = approvalDecisionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid decision data", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      try {
        const approval = await processApprovalDecision({
          approvalId,
          userId: parsed.data.userId,
          decision: parsed.data.decision,
          comments: parsed.data.comments,
        });
        return NextResponse.json({ approval });
      } catch (decisionError) {
        return NextResponse.json(
          { error: "Decision processing failed", details: String((decisionError as any)?.message ?? decisionError) },
          { status: 400 }
        );
      }
    }

    // Initiate approval workflow
    const parsed = approvalInitiateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid approval data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    try {
      const approval = await initiateApproval(parsed.data);
      return NextResponse.json({ approval }, { status: 201 });
    } catch (initError) {
      return NextResponse.json(
        { error: "Approval initiation failed", details: String((initError as any)?.message ?? initError) },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error("Approvals POST error:", (error as any)?.stack || error);
    return NextResponse.json(
      { error: "Internal server error", details: String((error as any)?.message ?? error) },
      { status: 500 }
    );
  }
}
