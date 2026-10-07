export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";
import { updateProjectTeamMember, removeProjectTeamMember } from "@/lib/projects/db";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const context = validateTenantContext(request as any, "write");
    const _gate1 = await requireModuleGate(request, "projects", "write");
    if (_gate1) return _gate1;
    const body = await request.json();
    const { role, email } = body;

    const member = await updateProjectTeamMember(params.memberId, context.tenantSlug, { role, email });
    if (!member) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }
    return NextResponse.json({ member, message: 'Team member updated successfully' });
  } catch (error) {
    console.error('Failed to update team member:', error);
    const message = error instanceof Error ? error.message : 'Failed to update team member';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; memberId: string } }
) {
  try {
    const context = validateTenantContext(request as any, "delete");
    const _gate2 = await requireModuleGate(request, "projects", "write");
    if (_gate2) return _gate2;
    const removed = await removeProjectTeamMember(params.memberId, context.tenantSlug);
    if (!removed) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Team member removed successfully' });
  } catch (error) {
    console.error('Failed to remove team member:', error);
    const message = error instanceof Error ? error.message : 'Failed to remove team member';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
