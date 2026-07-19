import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { updateProject } from "@/lib/projects/db";

export async function POST(request: Request) {
  try {
    const context = validateTenantContext(request as any, "write");
    const body = await request.json();
    const { projectIds } = body;

    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ error: "projectIds array is required" }, { status: 400 });
    }

    await Promise.all(
      projectIds.map((id: string) =>
        updateProject(id, context.tenantSlug, { status: "IN_PROGRESS" })
      )
    );

    return NextResponse.json({
      success: true,
      message: `${projectIds.length} project(s) restored successfully`,
      restoredCount: projectIds.length,
    });
  } catch (error) {
    console.error('Failed to restore projects:', error);
    const message = error instanceof Error ? error.message : 'Failed to restore projects';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
