export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";
import { deleteProject } from "@/lib/projects/db";

export async function POST(request: Request) {
  try {
    const context = validateTenantContext(request as any, "delete");
    const _gate1 = await requireModuleGate(request, "projects", "write");
    if (_gate1) return _gate1;
    const body = await request.json();
    const { projectIds } = body;

    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ error: "projectIds array is required" }, { status: 400 });
    }

    const results = await Promise.all(
      projectIds.map((id: string) => deleteProject(id, context.tenantSlug))
    );
    const deletedCount = results.filter(Boolean).length;

    return NextResponse.json({
      success: true,
      message: `${deletedCount} project(s) deleted permanently`,
      deletedCount,
    });
  } catch (error) {
    console.error('Failed to delete projects:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete projects';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
