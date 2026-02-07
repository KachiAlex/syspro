import { NextRequest, NextResponse } from "next/server";

import {
  createProject,
  listProjects,
  ProjectEntity,
} from "@/lib/projects-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";
  const status = searchParams.get("status") as ProjectEntity["status"] | null;
  const priority = searchParams.get("priority") as ProjectEntity["priority"] | null;

  const projects = listProjects(tenantSlug).filter((project) => {
    if (status && project.status !== status) {
      return false;
    }
    if (priority && project.priority !== priority) {
      return false;
    }
    return true;
  });

  const payload = {
    projects,
    totals: {
      count: projects.length,
      active: projects.filter((p) => p.status === "Active").length,
      approvedBudget: projects.reduce((acc, p) => acc + p.budgetApproved, 0),
      spentBudget: projects.reduce((acc, p) => acc + p.budgetSpent, 0),
    },
  };

  return NextResponse.json(payload);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    tenantSlug = "default",
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
  } = body as Partial<ProjectEntity> & { departments?: string[] };

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

  const project = createProject(tenantSlug, {
    name: name!,
    description: description!,
    objective: objective!,
    subsidiary: subsidiary!,
    branch: branch!,
    departments: departments!,
    startDate: startDate!,
    endDate: endDate!,
    priority: priority!,
    budgetApproved: Number(budgetApproved),
    budgetSpent: 0,
    status: "Planned",
    owner: owner!,
    approvalStatus: "Pending",
    region: region!,
    createdBy: createdBy!,
  });

  return NextResponse.json(
    { project, message: "Project created successfully" },
    { status: 201 }
  );
}
