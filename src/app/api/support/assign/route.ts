import { NextRequest, NextResponse } from "next/server";

import { suggestAssignment } from "@/lib/support-db";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const body = (await request.json()) as {
    tenantSlug?: string;
    serviceArea?: string;
    departmentId?: string;
    skills?: string[];
    region?: string;
  };

  const tenantSlug = context.tenantSlug;
  const assignment = await suggestAssignment({
    tenantSlug,
    serviceArea: body.serviceArea,
    departmentId: body.departmentId,
    skills: body.skills,
    region: body.region,
  });

  return NextResponse.json({ assignment });
}
