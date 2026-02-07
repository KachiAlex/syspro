import { NextRequest, NextResponse } from "next/server";

import { suggestAssignment } from "@/lib/support-data";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    tenantSlug?: string;
    serviceArea?: string;
    departmentId?: string;
    skills?: string[];
    region?: string;
  };

  const tenantSlug = body.tenantSlug || "default";
  const assignment = suggestAssignment({
    tenantSlug,
    serviceArea: body.serviceArea,
    departmentId: body.departmentId,
    skills: body.skills,
    region: body.region,
  });

  return NextResponse.json({ assignment });
}
