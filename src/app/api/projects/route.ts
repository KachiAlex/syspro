import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  return NextResponse.json({ projects: [], totals: { count: 0, active: 0, approvedBudget: 0, spentBudget: 0 } });
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const {
    name,
    description,
    objective,
    subsidiary,
    branch,
    departments,
    startDate,
    endDate,
    priority,
    budgetApproved,
    owner,
    region,
    createdBy,
  } = body as any;

  const missing = [
    name,
    description,
    objective,
    subsidiary,
    branch,
    departments && departments.length > 0 ? departments.join() : undefined,
    startDate,
    endDate,
    priority,
    budgetApproved,
    owner,
    region,
    createdBy,
  ].some((value) => value === undefined || value === null || value === "");

  if (missing) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const project = {
    id: `proj-${Date.now()}`,
    tenantSlug: context.tenantSlug,
    name,
    description,
    objective,
    subsidiary,
    branch,
    departments,
    startDate,
    endDate,
    priority,
    budgetApproved: Number(budgetApproved),
    budgetSpent: 0,
    status: "Planned",
    owner,
    approvalStatus: "Pending",
    region,
    createdBy,
  };

  return NextResponse.json(
    { project, message: "Project created successfully" },
    { status: 201 }
  );
}
