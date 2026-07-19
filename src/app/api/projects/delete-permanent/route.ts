import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { deleteProject } from "@/lib/projects/db";

export async function POST(request: Request) {
  try {
    const context = validateTenantContext(request as any, "delete");
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
