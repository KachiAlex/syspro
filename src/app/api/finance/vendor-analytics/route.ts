import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getVendorSpendReport,
  getVendorAgingReport,
  getVendorRiskScores,
  getTaxReport,
  getDashboardAnalytics,
} from "@/lib/finance/vendor-analytics";

const spendReportSchema = z.object({
  tenantSlug: z.string().min(1),
  vendorId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
});

const agingReportSchema = z.object({
  tenantSlug: z.string().min(1),
  vendorId: z.string().uuid().optional(),
  includePaid: z.coerce.boolean().optional(),
});

const riskScoreSchema = z.object({
  tenantSlug: z.string().min(1),
  vendorId: z.string().uuid().optional(),
});

const taxReportSchema = z.object({
  tenantSlug: z.string().min(1),
  vendorId: z.string().uuid().optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(), // YYYY-MM format
});

const dashboardSchema = z.object({
  tenantSlug: z.string().min(1),
});

export async function GET(request: NextRequest) {
  console.log('API: GET /api/finance/vendor-analytics called');
  
  try {
    const url = new URL(request.url);
    const reportType = url.searchParams.get("report");
    
    if (!reportType) {
      return NextResponse.json(
        { error: "report parameter required" },
        { status: 400 }
      );
    }

    const tenantSlug = url.searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json(
        { error: "tenantSlug parameter required" },
        { status: 400 }
      );
    }

    switch (reportType) {
      case "spend":
        const spendParsed = spendReportSchema.safeParse({
          tenantSlug,
          vendorId: url.searchParams.get("vendorId"),
          dateFrom: url.searchParams.get("dateFrom"),
          dateTo: url.searchParams.get("dateTo"),
          limit: url.searchParams.get("limit"),
        });

        if (!spendParsed.success) {
          return NextResponse.json(
            { error: "Invalid spend report parameters", details: spendParsed.error.flatten() },
            { status: 400 }
          );
        }

        const spendReport = await getVendorSpendReport(spendParsed.data.tenantSlug, {
          vendorId: spendParsed.data.vendorId,
          dateFrom: spendParsed.data.dateFrom,
          dateTo: spendParsed.data.dateTo,
          limit: spendParsed.data.limit,
        });
        return NextResponse.json({ report: spendReport });

      case "aging":
        const agingParsed = agingReportSchema.safeParse({
          tenantSlug,
          vendorId: url.searchParams.get("vendorId"),
          includePaid: url.searchParams.get("includePaid"),
        });

        if (!agingParsed.success) {
          return NextResponse.json(
            { error: "Invalid aging report parameters", details: agingParsed.error.flatten() },
            { status: 400 }
          );
        }

        const agingReport = await getVendorAgingReport(agingParsed.data.tenantSlug, {
          vendorId: agingParsed.data.vendorId,
          includePaid: agingParsed.data.includePaid,
        });
        return NextResponse.json({ report: agingReport });

      case "risk":
        const riskParsed = riskScoreSchema.safeParse({
          tenantSlug,
          vendorId: url.searchParams.get("vendorId"),
        });

        if (!riskParsed.success) {
          return NextResponse.json(
            { error: "Invalid risk score parameters", details: riskParsed.error.flatten() },
            { status: 400 }
          );
        }

        const riskReport = await getVendorRiskScores(riskParsed.data.tenantSlug, {
          vendorId: riskParsed.data.vendorId,
        });
        return NextResponse.json({ report: riskReport });

      case "tax":
        const taxParsed = taxReportSchema.safeParse({
          tenantSlug,
          vendorId: url.searchParams.get("vendorId"),
          period: url.searchParams.get("period"),
        });

        if (!taxParsed.success) {
          return NextResponse.json(
            { error: "Invalid tax report parameters", details: taxParsed.error.flatten() },
            { status: 400 }
          );
        }

        const taxReport = await getTaxReport(taxParsed.data.tenantSlug, {
          vendorId: taxParsed.data.vendorId,
          period: taxParsed.data.period,
        });
        return NextResponse.json({ report: taxReport });

      case "dashboard":
        const dashboardParsed = dashboardSchema.safeParse({ tenantSlug });

        if (!dashboardParsed.success) {
          return NextResponse.json(
            { error: "Invalid dashboard parameters", details: dashboardParsed.error.flatten() },
            { status: 400 }
          );
        }

        const dashboardData = await getDashboardAnalytics(tenantSlug);
        return NextResponse.json({ dashboard: dashboardData });

      default:
        return NextResponse.json(
          { error: "Invalid report type. Available: spend, aging, risk, tax, dashboard" },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error("Vendor Analytics GET error:", (error as any)?.stack || error);
    return NextResponse.json(
      { error: "Internal server error", details: String((error as any)?.message || error) },
      { status: 500 }
    );
  }
}
