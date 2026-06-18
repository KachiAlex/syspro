import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listAttendance, insertAttendance, getAttendanceStats } from "@/lib/hr/db";

const listSchema = z.object({
  tenantSlug: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  employeeId: z.string().optional(),
  status: z.enum(["present", "absent", "late", "half_day"]).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

const createSchema = z.object({
  tenantSlug: z.string().min(1),
  employeeId: z.string().min(1),
  employeeName: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["present", "absent", "late", "half_day"]),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    tenantSlug: url.searchParams.get("tenantSlug") ?? undefined,
    date: url.searchParams.get("date") ?? undefined,
    employeeId: url.searchParams.get("employeeId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const date = url.searchParams.get("statsDate");
    if (date) {
      const stats = await getAttendanceStats(parsed.data.tenantSlug, date);
      return NextResponse.json(stats);
    }

    const records = await listAttendance(parsed.data);
    return NextResponse.json({ records });
  } catch (error) {
    console.error("Attendance list failed", error);
    return NextResponse.json({ error: "Failed to load attendance" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Batch insert support
  if (Array.isArray((body as any).records)) {
    const records = (body as any).records;
    const tenantSlug = (body as any).tenantSlug;
    if (!tenantSlug || !Array.isArray(records)) {
      return NextResponse.json({ error: "Invalid batch payload" }, { status: 400 });
    }
    try {
      const inserted = [];
      for (const r of records) {
        const parsed = createSchema.safeParse({ ...r, tenantSlug });
        if (parsed.success) {
          inserted.push(await insertAttendance(parsed.data));
        }
      }
      return NextResponse.json({ records: inserted }, { status: 201 });
    } catch (error) {
      console.error("Attendance batch create failed", error);
      return NextResponse.json({ error: "Failed to record attendance batch" }, { status: 500 });
    }
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const record = await insertAttendance(parsed.data);
    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    console.error("Attendance create failed", error);
    return NextResponse.json({ error: "Failed to record attendance" }, { status: 500 });
  }
}
