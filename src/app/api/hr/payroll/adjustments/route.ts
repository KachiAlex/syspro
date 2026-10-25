export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listPayrollAdjustments,
} from "@/lib/hr/db";

import { requireModuleAccess } from "@/lib/api-auth";
const createSchema = z.object({
  tenantSlug: z.string().min(1),
  employeeId: z.string().min(1),
  type: z.enum(["increment", "deduction"]),
  category: z.enum(["bonus", "promotion", "fine", "loan_repayment", "other"]),
  amount: z.number().min(0),
  reason: z.string().optional(),
  effectivePeriod: z.string().regex(/^\d{4}-\d{2}$/),
  approvedBy: z.string().optional(),
});

export async function GET(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "people", "read");
    if (!_scope.ok) return _scope.response;

  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  const employeeId = url.searchParams.get("employeeId") || undefined;
  const period = url.searchParams.get("period") || undefined;
  const status = url.searchParams.get("status") as
    | "pending"
    | "applied"
    | "rejected"
    | undefined;

  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug required" }, { status: 400 });
  }

  try {
    const adjustments = await listPayrollAdjustments(tenantSlug, {
      employeeId,
      period,
      status,
    });
    return NextResponse.json({ adjustments });
  } catch (error) {
    console.error("Failed to list payroll adjustments:", error);
    return NextResponse.json(
      { error: "Failed to list adjustments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "people", "write");
    if (!_scope.ok) return _scope.response;

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Bonuses/deductions feed payroll — they route through the approval
    // chain instead of the self-reported approvedBy field. The adjustment
    // row only exists once the chain approves.
    const { gateOrRun } = await import("@/lib/finance/gated-actions");
    const outcome = await gateOrRun(
      parsed.data.tenantSlug,
      "payroll_adjustment",
      parsed.data,
      { requestedBy: _scope.user.id }
    );
    if (outcome.status === "pending") {
      return NextResponse.json(
        { pendingApproval: true, approvalId: outcome.approvalId },
        { status: 202 }
      );
    }
    if (outcome.status === "denied") {
      return NextResponse.json({ error: outcome.error }, { status: 403 });
    }
    return NextResponse.json({ id: outcome.result.id });
  } catch (error) {
    console.error("Failed to create payroll adjustment:", error);
    return NextResponse.json(
      { error: "Failed to create adjustment" },
      { status: 500 }
    );
  }
}
