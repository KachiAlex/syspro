import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  generatePnLReport,
  generateBalanceSheet,
  generateCashFlowReport,
  generateAgedReceivablesReport,
} from "@/lib/finance/reports-db";

const generateSchema = z.object({
  tenantSlug: z.string().min(1),
  type: z.enum(["pl", "balance", "cashflow", "aged"]).default("pl"),
  period: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { tenantSlug, type, startDate, endDate } = parsed.data;

    const filters = {
      tenantId: BigInt(0), // tenantSlug is used as filter in views
      periodStart: startDate ? new Date(startDate) : undefined,
      periodEnd: endDate ? new Date(endDate) : undefined,
    };

    let report: any = null;
    switch (type) {
      case "pl":
        report = await generatePnLReport(filters);
        break;
      case "balance":
        report = await generateBalanceSheet(filters);
        break;
      case "cashflow":
        report = await generateCashFlowReport(filters);
        break;
      case "aged":
        report = await generateAgedReceivablesReport(filters);
        break;
    }

    return NextResponse.json({ report, type });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Report generation failed:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to generate report", details: errorMessage },
      { status: 500 }
    );
  }
}
