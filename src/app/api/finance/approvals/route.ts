export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createApprovalRule,
  getApprovalRules,
  updateApprovalRule,
  deleteApprovalRule,
  initiateApproval,
  processApprovalDecision,
  getApprovals,
  getPendingApprovalsForUser,
  createDelegate,
  listDelegates,
  revokeDelegate,
  getOfficers,
  setOfficers,
  tenantAuthorityMatrix,
  setApprovalSettings,
} from "@/lib/finance/approvals";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

const ENTITY_TYPES = ["purchase_order", "bill", "payment", "journal_entry", "sales_return", "purchase_return", "expense", "employee_expense", "payroll_run", "employee_salary_change", "credit_limit_change", "stock_adjustment", "bank_guarantee", "invoice_discounting", "pricing_change", "gated_action"] as const;

const approvalRuleCreateSchema = z.object({
  tenantSlug: z.string().min(1),
  entityType: z.enum(ENTITY_TYPES),
  ruleType: z.enum(["amount_based", "department_based", "project_based", "vendor_based", "category_based"]),
  conditions: z.record(z.any()),
  approvers: z.array(z.object({
    step: z.number().nonnegative(),
    userId: z.string().min(1),
    role: z.string().optional(),
    required: z.boolean(),
    order: z.number().nonnegative(),
  })),
  priority: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

const approvalRuleUpdateSchema = z.object({
  ruleId: z.string().min(1),
  entityType: z.enum(ENTITY_TYPES).optional(),
  ruleType: z.enum(["amount_based", "department_based", "project_based", "vendor_based", "category_based"]).optional(),
  conditions: z.record(z.any()).optional(),
  approvers: z.array(z.object({
    step: z.number().nonnegative(),
    userId: z.string().min(1),
    role: z.string().optional(),
    required: z.boolean(),
    order: z.number().nonnegative(),
  })).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().optional(),
});

const officersSchema = z.object({
  officers: z.array(z.object({
    title: z.string().min(1).max(80),
    userIds: z.array(z.string().min(1)),
  })).max(50),
});

const delegateCreateSchema = z.object({
  delegatorId: z.string().min(1),
  delegateId: z.string().min(1),
  entityType: z.enum(ENTITY_TYPES).optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  note: z.string().optional(),
});

const approvalInitiateSchema = z.object({
  tenantSlug: z.string().min(1),
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().min(1),
  requestedBy: z.string().min(1),
  entityData: z.record(z.any()),
});

const approvalDecisionSchema = z.object({
  userId: z.string().min(1).optional(),
  decision: z.enum(["approved", "rejected", "escalated", "clarification_needed"]),
  comments: z.string().optional(),
});

const approvalListSchema = z.object({
  tenantSlug: z.string().min(1),
  entityType: z.string().optional(),
  entityId: z.string().min(1).optional(),
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

    // Company officers (Managing Director, Chairman, …)
    if (url.searchParams.get("officers") === "true") {
      const officers = await getOfficers(tenantSlug);
      return NextResponse.json({ officers });
    }

    // Delegation-of-authority matrix + thresholds (Policy tab)
    if (url.searchParams.get("matrix") === "true") {
      const matrix = await tenantAuthorityMatrix(tenantSlug);
      const { db } = await import("@/lib/sql-client");
      const t = (await db.query(`select settings from tenants where slug = $1`, [tenantSlug])).rows[0];
      return NextResponse.json({
        matrix,
        approvals: (t?.settings as any)?.approvals ?? {},
      });
    }

    // Registered gated actions — powers the rules editor's action picker
    // and explains what each flow is gated by.
    if (url.searchParams.get("gated-actions") === "true") {
      const { listGatedActions } = await import("@/lib/finance/gated-actions");
      return NextResponse.json({ actions: listGatedActions() });
    }

    // Delegation grants
    if (url.searchParams.get("delegates") === "true") {
      const delegates = await listDelegates(tenantSlug, {
        delegatorId: url.searchParams.get("delegatorId") ?? undefined,
        delegateId: url.searchParams.get("delegateId") ?? undefined,
      });
      return NextResponse.json({ delegates });
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
    const tenantSlug = ctx.tenantSlug;
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

    // Update an existing rule (conditions, steps, active flag, priority)
    if (body.action === "update-rule") {
      const parsed = approvalRuleUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid rule update", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const { ruleId, ...updates } = parsed.data;
      const rule = await updateApprovalRule(tenantSlug, ruleId, updates);
      if (!rule) {
        return NextResponse.json({ error: "Rule not found" }, { status: 404 });
      }
      return NextResponse.json({ rule });
    }

    if (body.action === "delete-rule") {
      const ruleId = body.ruleId;
      if (!ruleId) {
        return NextResponse.json({ error: "ruleId required" }, { status: 400 });
      }
      const deleted = await deleteApprovalRule(tenantSlug, ruleId);
      if (!deleted) {
        return NextResponse.json({ error: "Rule not found" }, { status: 404 });
      }
      return NextResponse.json({ deleted: true });
    }

    // Delegation grants (out-of-office authority transfer)
    if (body.action === "create-delegate") {
      const parsed = delegateCreateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid delegation", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      try {
        const delegate = await createDelegate({ tenantSlug, ...parsed.data });
        return NextResponse.json({ delegate }, { status: 201 });
      } catch (delegateError) {
        return NextResponse.json(
          { error: String((delegateError as any)?.message ?? delegateError) },
          { status: 400 }
        );
      }
    }

    if (body.action === "revoke-delegate") {
      const id = body.delegateRecordId;
      if (!id) {
        return NextResponse.json({ error: "delegateRecordId required" }, { status: 400 });
      }
      const revoked = await revokeDelegate(tenantSlug, id);
      if (!revoked) {
        return NextResponse.json({ error: "Delegation not found" }, { status: 404 });
      }
      return NextResponse.json({ revoked: true });
    }

    // Company officers: named posts (MD, Chairman, …) mapped to users.
    // `role:<slug-of-title>` in a rule step resolves to these users at
    // initiation — company-wide authorities, unlike dept-scoped managers.
    if (body.action === "set-officers") {
      const parsed = officersSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid officers", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const officers = await setOfficers(tenantSlug, parsed.data.officers);
      return NextResponse.json({ officers });
    }

    // DoA matrix + threshold settings — the Policy tab writes through here.
    if (body.action === "save-settings") {
      const patch = body.patch;
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        return NextResponse.json({ error: "patch object required" }, { status: 400 });
      }
      const settings = await setApprovalSettings(tenantSlug, patch);
      return NextResponse.json({ settings });
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
