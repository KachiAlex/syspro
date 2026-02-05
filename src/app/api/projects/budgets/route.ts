import { NextRequest, NextResponse } from "next/server";

// In-memory storage for project budgets
const budgets: Record<string, Array<{ id: string; projectId: string; totalBudget: number; spent: number; remaining: number }>> = {};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";

  const tenantBudgets = budgets[tenantSlug] || [];
  return NextResponse.json({ budgets: tenantBudgets });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenantSlug = "default", projectId, totalBudget } = body;

  if (!projectId || !totalBudget) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (!budgets[tenantSlug]) {
    budgets[tenantSlug] = [];
  }

  const newBudget = {
    id: `budget-${Date.now()}`,
    projectId,
    totalBudget: parseFloat(totalBudget),
    spent: 0,
    remaining: parseFloat(totalBudget),
  };

  budgets[tenantSlug].push(newBudget);

  return NextResponse.json(
    { budget: newBudget, message: "Budget created successfully" },
    { status: 201 }
  );
}
