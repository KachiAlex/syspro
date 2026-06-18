import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  return NextResponse.json({ budgets: [] });
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const { projectId, totalBudget } = body;

  if (!projectId || !totalBudget) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const newBudget = {
    id: `budget-${Date.now()}`,
    projectId,
    totalBudget: parseFloat(totalBudget),
    spent: 0,
    remaining: parseFloat(totalBudget),
  };

  return NextResponse.json(
    { budget: newBudget, message: "Budget created successfully" },
    { status: 201 }
  );
}
