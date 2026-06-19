import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listRequisitions, insertRequisition, countRequisitions } from "@/lib/hr/db-recruitment";
import { extractAuthContext } from "@/lib/auth-helper";
import { resolveDepartmentHeadContext } from "@/lib/tenant-admin/utils";

const listSchema = z.object({
  tenantSlug: z.string().min(1),
  status: z.string().optional(),
  departmentId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

const createSchema = z.object({
  tenantSlug: z.string().min(1),
  title: z.string().min(1),
  departmentId: z.string().min(1),
  branchId: z.string().optional(),
  headcount: z.number().int().positive().optional(),
  budget: z.number().nonnegative().optional(),
  requiredSkills: z.array(z.string()).default([]),
  minExperienceYears: z.number().int().nonnegative().optional(),
  employmentType: z.enum(["full-time", "part-time", "contract", "intern"]),
  description: z.string().min(1),
  requirements: z.string().optional(),
  location: z.string().optional(),
  salaryRange: z.string().optional(),
  requestedBy: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    tenantSlug: url.searchParams.get("tenantSlug") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    departmentId: url.searchParams.get("departmentId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    // Apply department head scoping
    const auth = extractAuthContext(request);
    const context = await resolveDepartmentHeadContext({
      tenantSlug: parsed.data.tenantSlug,
      userId: auth.userId || 'unknown',
      userRole: auth.userRole || 'user',
      userPermissions: auth.userPermissions || [],
    });
    if (context.managedDepartmentId && !parsed.data.departmentId) {
      parsed.data.departmentId = context.managedDepartmentId;
    }

    const [requisitions, total] = await Promise.all([
      listRequisitions(parsed.data),
      countRequisitions({ tenantSlug: parsed.data.tenantSlug, status: parsed.data.status, departmentId: parsed.data.departmentId }),
    ]);
    return NextResponse.json({ requisitions, total });
  } catch (error) {
    console.error("Requisition list failed", error);
    return NextResponse.json({ error: "Failed to load requisitions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const requisition = await insertRequisition(parsed.data);
    return NextResponse.json({ requisition }, { status: 201 });
  } catch (error) {
    console.error("Requisition create failed", error);
    return NextResponse.json({ error: "Failed to create requisition" }, { status: 500 });
  }
}
