export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";
import { getProjectTeam, addProjectTeamMember } from "@/lib/projects/db";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = validateTenantContext(request as any, "read");
    const _gate1 = await requireModuleGate(request, "projects", "read");
    if (_gate1) return _gate1;
    const members = await getProjectTeam(params.id, context.tenantSlug);
    return NextResponse.json({ members });
  } catch (error) {
    console.error('Failed to fetch team members:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch team members';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = validateTenantContext(request as any, "write");
    const _gate2 = await requireModuleGate(request, "projects", "write");
    if (_gate2) return _gate2;
    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 });
    }

    const member = await addProjectTeamMember(params.id, context.tenantSlug, { email, role }, context.userId);
    return NextResponse.json({ member, message: "Team member added successfully" }, { status: 201 });
  } catch (error) {
    console.error('Failed to add team member:', error);
    const message = error instanceof Error ? error.message : 'Failed to add team member';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
