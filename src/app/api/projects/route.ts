import { NextRequest, NextResponse } from "next/server";

// In-memory storage for projects
const projects: Record<string, Array<{ id: string; name: string; client: string; status: "active" | "completed" | "on-hold"; budget: number; spent: number; progress: number; startDate: string; endDate: string }>> = {};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug") || "default";

  const tenantProjects = projects[tenantSlug] || [];
  return NextResponse.json({ projects: tenantProjects });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenantSlug = "default", name, client, budget, startDate, endDate } = body;

  if (!name || !client || !budget || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (!projects[tenantSlug]) {
    projects[tenantSlug] = [];
  }

  const newProject = {
    id: `proj-${Date.now()}`,
    name,
    client,
    status: "active" as const,
    budget: parseFloat(budget),
    spent: 0,
    progress: 0,
    startDate,
    endDate,
  };

  projects[tenantSlug].push(newProject);

  return NextResponse.json(
    { project: newProject, message: "Project created successfully" },
    { status: 201 }
  );
}
