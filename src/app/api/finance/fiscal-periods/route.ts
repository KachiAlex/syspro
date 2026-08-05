import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createFiscalPeriod,
  listFiscalPeriods,
  getFiscalPeriod,
  closeFiscalPeriod,
  lockFiscalPeriod,
  reopenFiscalPeriod,
  getCurrentPeriod,
  generateYearlyPeriods,
} from "@/lib/finance/fiscal-periods";

const createSchema = z.object({
  tenantSlug: z.string().min(1),
  name: z.string().min(1),
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  periodNumber: z.coerce.number().int().min(1),
  periodType: z.enum(["month", "quarter", "year"]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  notes: z.string().optional(),
});

const generateSchema = z.object({
  tenantSlug: z.string().min(1),
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  periodType: z.enum(["month", "quarter"]),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantSlug = searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }

    const action = searchParams.get("action");

    if (action === "current") {
      const period = await getCurrentPeriod(tenantSlug);
      return NextResponse.json({ success: true, data: period });
    }

    const fiscalYear = searchParams.get("fiscalYear") ? parseInt(searchParams.get("fiscalYear")!) : undefined;
    const periods = await listFiscalPeriods(tenantSlug, fiscalYear);
    return NextResponse.json({ success: true, data: periods });
  } catch (error) {
    console.error("Error fetching fiscal periods:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || "create";

    if (action === "generate") {
      const parsed = generateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
      }
      const periods = await generateYearlyPeriods(parsed.data.tenantSlug, parsed.data.fiscalYear, parsed.data.periodType);
      return NextResponse.json({ success: true, data: periods });
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
    }
    const period = await createFiscalPeriod(parsed.data);
    return NextResponse.json({ success: true, data: period });
  } catch (error) {
    console.error("Error creating fiscal period:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const tenantSlug = searchParams.get("tenantSlug");
    const id = searchParams.get("id");
    const action = body.action;

    if (!tenantSlug || !id) {
      return NextResponse.json({ success: false, error: "tenantSlug and id are required" }, { status: 400 });
    }

    if (action === "close") {
      const period = await closeFiscalPeriod(id, tenantSlug, body.closedBy || "system", body.notes);
      return NextResponse.json({ success: true, data: period });
    }

    if (action === "lock") {
      const period = await lockFiscalPeriod(id, tenantSlug);
      return NextResponse.json({ success: true, data: period });
    }

    if (action === "reopen") {
      const period = await reopenFiscalPeriod(id, tenantSlug);
      return NextResponse.json({ success: true, data: period });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating fiscal period:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
