export const dynamic = "force-dynamic";
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
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

const approvalRuleCreateSchema = z.object({
  tenantSlug: z.string().min(1),
  entityType: z.enum(["purchase_order", "bill", "payment"]),
  ruleType: z.enum(["amount_based", "department_based", "project_based", "vendor_based"]),
  conditions: z.record(z.any()),
  approvers: z.array(z.object({
    step: z.number().positive(),
    userId: z.string().min(1),
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
  requestedBy: z.string().min(1),
  entityData: z.record(z.any()),
});

const approvalDecisionSchema = z.object({
  userId: z.string().min(1).optional(),
  decision: z.enum(["approved", "rejected", "escalated"]),
  comments: z.string().optional(),
});

const approvalListSchema = z.object({
  tenantSlug: z.string().min(1),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  status: z.string().optional(),
  userId: z.string().min(1).optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
  offset: z.coerce.number().min(0).optional(),
});

export async function GET(request: NextRequest) {
  console.log('API: GET /api/finance/approvals called');

  try {
    const ctx = validateTenantContext(request, "read");
    const _gate = await requireModuleAccess(request, "finance", "read");
    if (!_gate.ok) return _gate.response;
    const url = new URL(request.url);
    const tenantSlug = ctx.tenantSlug;

    // Get approval rules
    if (url.searchParams.get("rules") === "true") {
      const entityType = url.searchParams.get("entityType");
      const isActive = url.searchParams.get("isActive");

      const rules = await getApprovalRules({
        tenantSlug,
        entityType: entityType || undefined,
        isActive: isActive !== null ? isActive === "true" : undefined
      });

      return NextResponse.json({ rules });
    }

    // Get pending approvals for user
    if (url.searchParams.get("pending") === "true") {
      const userId = url.searchParams.get("userId");

      if (!userId) {
        return NextResponse.json(
          { error: "userId parameter required" },
          { status: 400 }
        );
      }

      const approvals = await getPendingApprovalsForUser(tenantSlug, userId, ctx.userRole);
      return NextResponse.json({ approvals });
    }

    // Get single approval by ID
    if (url.searchParams.get("id")) {
      const approvalId = url.searchParams.get("id")!;
      const approvals = await getApprovals({
        tenantSlug,
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
      tenantSlug,
      entityType: url.searchParams.get("entityType") ?? undefined,
      entityId: url.searchParams.get("entityId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      userId: url.searchParams.get("userId") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
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
    const ctx = validateTenantContext(request, "write");
    const _gate = await requireModuleAccess(request, "finance", "write");
    if (!_gate.ok) return _gate.response;
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
          userId: ctx.userId !== "unknown" ? ctx.userId : (parsed.data.userId ?? ctx.userId),
          userRole: ctx.userRole,
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
