import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { updateProject, toProjectResponse } from "@/lib/projects/db";

async function restore(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = validateTenantContext(request as any, "write");
    const updated = await updateProject(params.id, context.tenantSlug, { status: "IN_PROGRESS" } as any);
    if (!updated) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      id: params.id,
      project: toProjectResponse(updated),
      message: 'Project restored successfully',
    });
  } catch (error) {
    console.error('Failed to restore project:', error);
    const message = error instanceof Error ? error.message : 'Failed to restore project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = restore;
export const PATCH = restore;
