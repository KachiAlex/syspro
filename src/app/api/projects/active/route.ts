import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { getAllProjectsForTenant, toProjectResponse } from "@/lib/projects/db";

export async function GET(request: Request) {
  try {
    const context = validateTenantContext(request as any, "read");
    const projects = await getAllProjectsForTenant(context.tenantSlug);
    const active = projects
      .filter((p) => ["IN_PROGRESS", "INITIATED", "PLANNING"].includes(p.status))
      .map(toProjectResponse);
    return NextResponse.json({ projects: active });
  } catch (error) {
    console.error('Failed to fetch active projects:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch active projects';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
