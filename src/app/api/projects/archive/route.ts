import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";

export async function GET(request: Request) {
  try {
    const context = validateTenantContext(request as any, "read");
    return NextResponse.json({ projects: [] });
  } catch (error) {
    console.error('Failed to fetch archived projects:', error);
    return NextResponse.json({ error: 'Failed to fetch archived projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = validateTenantContext(request as any, "write");
    const body = await request.json();
    const { projectIds } = body;

    return NextResponse.json({
      success: true,
      message: `${projectIds?.length || 0} project(s) archived successfully`,
      archivedCount: projectIds?.length || 0
    });
  } catch (error) {
    console.error('Failed to archive projects:', error);
    return NextResponse.json({ error: 'Failed to archive projects' }, { status: 500 });
  }
}
