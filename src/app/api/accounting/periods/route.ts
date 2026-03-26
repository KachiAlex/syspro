import { NextRequest, NextResponse } from "next/server";
import { fiscalPeriodCreateSchema } from "@/lib/accounting/types";
import {
  createFiscalPeriod,
  getFiscalPeriods,
  lockFiscalPeriod,
} from "@/lib/accounting/db";

/**
 * GET /api/accounting/periods
 * List fiscal periods for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug");
    const fiscalYear = url.searchParams.get("fiscalYear");
    const status = url.searchParams.get("status");

    if (!tenantSlug) {
      return NextResponse.json(
        { error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    const periods = await getFiscalPeriods(tenantSlug, {
      fiscalYear: fiscalYear ? parseInt(fiscalYear) : undefined,
      status: status || undefined,
    });

    return NextResponse.json({ data: periods });
  } catch (error) {
    console.error("Error fetching fiscal periods:", error);
    return NextResponse.json(
      { error: "Failed to fetch fiscal periods" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounting/periods
 * Create a new fiscal period
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = fiscalPeriodCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const period = await createFiscalPeriod(parsed.data);

    return NextResponse.json({ data: period }, { status: 201 });
  } catch (error) {
    console.error("Error creating fiscal period:", error);
    return NextResponse.json(
      { error: "Failed to create fiscal period" },
      { status: 500 }
    );
  }
}
