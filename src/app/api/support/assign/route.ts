export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { suggestAssignment } from "@/lib/support-db";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const _gate1 = await requireModuleGate(request, "itsupport", "read");
  if (_gate1) return _gate1;
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
