export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { financeAccountUpdateSchema } from "@/lib/finance/types";
import { updateFinanceAccount } from "@/lib/finance/db";

import { requireRecordTenant, requireModuleAccess } from "@/lib/api-auth";
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const _scope = await requireModuleAccess(request, "finance", "write");
    if (!_scope.ok) return _scope.response;

  const params = await context.params;
  const _owned = await requireRecordTenant("finance_accounts", params.id, _scope.user);
  if (!_owned.ok) return _owned.response;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = financeAccountUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const account = await updateFinanceAccount(params.id, parsed.data);
    if (!account) {
      return NextResponse.json({ error: "Finance account not found" }, { status: 404 });
    }
    return NextResponse.json({ account });
  } catch (error) {
    console.error("Finance account update failed", error);
    return NextResponse.json({ error: "Failed to update finance account" }, { status: 500 });
  }
}
