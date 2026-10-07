export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";
import { getProject, updateProject, toProjectResponse } from "@/lib/projects/db";

async function archive(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = validateTenantContext(request as any, "write");
    const _gate1 = await requireModuleGate(request, "projects", "write");
    if (_gate1) return _gate1;
    const updated = await updateProject(params.id, context.tenantSlug, { status: "ARCHIVED" } as any);
    if (!updated) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      id: params.id,
      project: toProjectResponse(updated),
      message: 'Project archived successfully',
    });
  } catch (error) {
    console.error('Failed to archive project:', error);
    const message = error instanceof Error ? error.message : 'Failed to archive project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = archive;
export const PATCH = archive;
