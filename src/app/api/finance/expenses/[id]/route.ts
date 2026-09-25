import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { expenseApproveSchema } from "@/lib/finance/types";
import { getExpense, approveExpense } from "@/lib/finance/db";

import { requireModuleAccess } from "@/lib/api-auth";
export async function GET(
  request: NextRequest,
  context: any
) {
    const _scope = await requireModuleAccess(request, "finance", "read");
    if (!_scope.ok) return _scope.response;

  const { params } = context;
  const tenantSlug = new URL(request.url).searchParams.get("tenantSlug");

  if (!tenantSlug) {
    return NextResponse.json({ error: "Missing tenantSlug" }, { status: 400 });
  }

  try {
    const expense = await getExpense(params.id, tenantSlug);
    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }
    return NextResponse.json({ expense });
  } catch (error) {
    console.error("Get expense failed", error);
    return NextResponse.json({ error: "Failed to get expense" }, { status: 500 });
  }
}
