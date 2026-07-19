import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import {
  getBudgetAllocationsForProject,
  createBudgetAllocation,
} from "@/lib/projects/db";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = validateTenantContext(request as any, "read");
    const allocations = await getBudgetAllocationsForProject(params.id, context.tenantSlug);
    return NextResponse.json({ allocations });
  } catch (error) {
    console.error('Failed to fetch budget allocations:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch budget allocations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = validateTenantContext(request as any, "write");
    const body = await request.json();
    const { category, allocated } = body;

    if (!category || allocated === undefined) {
      return NextResponse.json({ error: "category and allocated are required" }, { status: 400 });
    }

    const allocation = await createBudgetAllocation(
      params.id,
      context.tenantSlug,
      { category: String(category), allocated: Number(allocated) },
      context.userId
    );
    return NextResponse.json({ allocation, message: "Budget allocation created" }, { status: 201 });
  } catch (error) {
    console.error('Failed to create budget allocation:', error);
    const message = error instanceof Error ? error.message : 'Failed to create budget allocation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
