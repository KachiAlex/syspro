export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";
import { getAllProjectsForTenant, updateProject, toProjectResponse } from "@/lib/projects/db";

export async function GET(request: Request) {
  try {
    const context = validateTenantContext(request as any, "read");
    const _gate1 = await requireModuleGate(request, "projects", "read");
    if (_gate1) return _gate1;
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
    const _gate2 = await requireModuleGate(request, "projects", "write");
    if (_gate2) return _gate2;
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
