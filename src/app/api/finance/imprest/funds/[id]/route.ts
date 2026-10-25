export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getFund, pettyCashBook,
} from "@/lib/finance/imprest";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const { id } = await params;
  try {
    if (new URL(request.url).searchParams.get("book") === "true") {
      return NextResponse.json(await pettyCashBook(context.tenantSlug, id));
    }
    const fund = await getFund(context.tenantSlug, id);
    return NextResponse.json({ fund });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("replenish"),
    txnDate: z.string().min(8),
    amount: z.coerce.number().positive().optional(),
    description: z.string().optional(),
  }),
  z.object({
    action: z.literal("disburse"),
    txnDate: z.string().min(8),
    amount: z.coerce.number().positive(),
    expenseAccountCode: z.string().min(1),
    description: z.string().optional(),
  }),
]);

export async function POST(request: NextRequest, { params }: Params) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const tenantSlug = context.tenantSlug;
    // Replenishment (Dr petty cash / Cr bank) and disbursement (Dr expense /
    // Cr petty cash) are cash movements — they route through the approval
    // chain and only post once approved.
    const { gateOrRun } = await import("@/lib/finance/gated-actions");
    const action = parsed.data.action === "replenish" ? "imprest_replenish" : "imprest_disburse";
    const outcome = await gateOrRun(
      tenantSlug,
      action,
      { fundId: id, ...parsed.data },
      { requestedBy: context.userId ?? "unknown" }
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
    return NextResponse.json(outcome.result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
