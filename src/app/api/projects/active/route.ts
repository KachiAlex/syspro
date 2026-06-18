import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";

export async function GET(request: Request) {
  try {
    const context = validateTenantContext(request as any, "read");
    return NextResponse.json({ projects: [] });
  } catch (error) {
    console.error('Failed to fetch active projects:', error);
    return NextResponse.json({ error: 'Failed to fetch active projects' }, { status: 500 });
  }
}
