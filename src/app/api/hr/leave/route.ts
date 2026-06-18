import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listLeave, insertLeave, getLeaveBalance } from "@/lib/hr/db";

const listSchema = z.object({
  tenantSlug: z.string().min(1),
  employeeId: z.string().optional(),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  leaveType: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

const createSchema = z.object({
  tenantSlug: z.string().min(1),
  employeeId: z.string().min(1),
  employeeName: z.string().min(1),
  leaveType: z.enum(["annual", "sick", "personal", "maternity", "paternity", "unpaid"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    tenantSlug: url.searchParams.get("tenantSlug") ?? undefined,
    employeeId: url.searchParams.get("employeeId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    leaveType: url.searchParams.get("leaveType") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const employeeId = url.searchParams.get("employeeId");
    if (employeeId) {
      const balance = await getLeaveBalance(parsed.data.tenantSlug, employeeId);
      return NextResponse.json(balance);
    }

    const requests = await listLeave(parsed.data);
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Leave list failed", error);
    return NextResponse.json({ error: "Failed to load leave requests" }, { status: 500 });
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
    const requestRecord = await insertLeave(parsed.data);
    return NextResponse.json({ request: requestRecord }, { status: 201 });
  } catch (error) {
    console.error("Leave create failed", error);
    return NextResponse.json({ error: "Failed to submit leave request" }, { status: 500 });
  }
}
