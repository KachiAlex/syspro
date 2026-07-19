import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { getAllProjectsForTenant, updateProject, toProjectResponse } from "@/lib/projects/db";

export async function GET(request: Request) {
  try {
    const context = validateTenantContext(request as any, "read");
    const projects = await getAllProjectsForTenant(context.tenantSlug);
    const archived = projects
      .filter((p) => ["ARCHIVED", "COMPLETED"].includes(p.status))
      .map(toProjectResponse);
    return NextResponse.json({ projects: archived });
  } catch (error) {
    console.error('Failed to fetch archived projects:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch archived projects';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = validateTenantContext(request as any, "write");
    const body = await request.json();
    const { projectIds } = body as { projectIds?: string[] };
    const ids = Array.isArray(projectIds) ? projectIds : [];

    await Promise.all(ids.map((id) => updateProject(id, context.tenantSlug, { status: "ARCHIVED" } as any)));

    return NextResponse.json({
      success: true,
      message: `${ids.length} project(s) archived successfully`,
      archivedCount: ids.length,
    });
  } catch (error) {
    console.error('Failed to archive projects:', error);
    const message = error instanceof Error ? error.message : 'Failed to archive projects';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
