import { NextRequest, NextResponse } from "next/server";
import { listProjects, deleteProject } from "@/lib/projects-data";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const tenantSlug = new URL(request.url).searchParams.get("tenantSlug") || "default";
  
  const projects = listProjects(tenantSlug);
  const project = projects.find((p) => p.id === id);

  if (!project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ project });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const tenantSlug = new URL(request.url).searchParams.get("tenantSlug") || "default";

  try {
    deleteProject(tenantSlug, id);
    return NextResponse.json(
      { message: "Project deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
