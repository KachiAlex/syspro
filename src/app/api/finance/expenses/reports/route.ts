import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listExpenses } from "@/lib/finance/db";

const reportSchema = z.object({
  tenantSlug: z.string().min(1),
  type: z.enum(["summary", "by-category", "aged", "tax-summary"]).default("summary"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = reportSchema.safeParse({
    tenantSlug: url.searchParams.get("tenantSlug") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    startDate: url.searchParams.get("startDate") ?? undefined,
    endDate: url.searchParams.get("endDate") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { tenantSlug, type, startDate, endDate } = parsed.data;

    // Get all expenses
    const expenses = await listExpenses({ tenantSlug, limit: 1000 });

    // Filter by date range if provided
    let filtered = expenses;
    if (startDate || endDate) {
      filtered = expenses.filter((e) => {
        if (startDate && e.date < startDate) return false;
        if (endDate && e.date > endDate) return false;
        return true;
      });
    }

    let report: any;

    switch (type) {
      case "summary":
        report = generateSummaryReport(filtered);
        break;
      case "by-category":
        report = generateCategoryReport(filtered);
        break;
      case "aged":
        report = generateAgedReport(filtered);
        break;
      case "tax-summary":
        report = generateTaxReport(filtered);
        break;
      default:
        report = generateSummaryReport(filtered);
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Generate report failed", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

function generateSummaryReport(expenses: any[]) {
  const approved = expenses.filter((e) => e.approvalStatus === "APPROVED");
  const pending = expenses.filter((e) => e.approvalStatus === "PENDING");
  const paid = expenses.filter((e) => e.paymentStatus === "PAID");
  const unpaid = expenses.filter((e) => e.paymentStatus === "UNPAID");

  const sum = (arr: any[]) => arr.reduce((acc, e) => acc + e.amount, 0);
  const avgAmount = expenses.length > 0 ? sum(expenses) / expenses.length : 0;

  return {
    type: "summary",
    period: {
      startDate: expenses.length > 0 ? Math.min(...expenses.map((e) => new Date(e.date).getTime())) : new Date(),
      endDate: expenses.length > 0 ? Math.max(...expenses.map((e) => new Date(e.date).getTime())) : new Date(),
    },
    totals: {
      totalExpenses: sum(expenses),
      totalApproved: sum(approved),
      totalPending: sum(pending),
      totalPaid: sum(paid),
      totalUnpaid: sum(unpaid),
      averageExpense: Math.round(avgAmount * 100) / 100,
      expenseCount: expenses.length,
      approvedCount: approved.length,
      pendingCount: pending.length,
    },
    statusBreakdown: {
      approvalStatus: {
        DRAFT: expenses.filter((e) => e.approvalStatus === "DRAFT").length,
        PENDING: pending.length,
        APPROVED: approved.length,
        REJECTED: expenses.filter((e) => e.approvalStatus === "REJECTED").length,
        CLARIFY_NEEDED: expenses.filter((e) => e.approvalStatus === "CLARIFY_NEEDED").length,
      },
      paymentStatus: {
        UNPAID: unpaid.length,
        PAID: paid.length,
        REIMBURSED: expenses.filter((e) => e.paymentStatus === "REIMBURSED").length,
        PENDING: expenses.filter((e) => e.paymentStatus === "PENDING").length,
      },
    },
  };
}

function generateCategoryReport(expenses: any[]) {
  const byCategory: Record<string, any> = {};

  expenses.forEach((e) => {
    if (!byCategory[e.category]) {
      byCategory[e.category] = {
        category: e.category,
        count: 0,
        total: 0,
        approved: 0,
        pending: 0,
        paid: 0,
        unpaid: 0,
      };
    }

    byCategory[e.category].count += 1;
    byCategory[e.category].total += e.amount;
    if (e.approvalStatus === "APPROVED") byCategory[e.category].approved += e.amount;
    if (e.approvalStatus === "PENDING") byCategory[e.category].pending += e.amount;
    if (e.paymentStatus === "PAID") byCategory[e.category].paid += e.amount;
    if (e.paymentStatus === "UNPAID") byCategory[e.category].unpaid += e.amount;
  });

  return {
    type: "by-category",
    byCategory: Object.values(byCategory),
    totalCategories: Object.keys(byCategory).length,
  };
}

function generateAgedReport(expenses: any[]) {
  const now = new Date();
  const ranges = {
    current: { min: 0, max: 30, count: 0, total: 0, description: "0-30 days" },
    "30_60": { min: 30, max: 60, count: 0, total: 0, description: "30-60 days" },
    "60_90": { min: 60, max: 90, count: 0, total: 0, description: "60-90 days" },
    over_90: { min: 90, max: Infinity, count: 0, total: 0, description: "Over 90 days" },
  };

  expenses.forEach((e) => {
    const expenseDate = new Date(e.date);
    const daysOld = Math.floor((now.getTime() - expenseDate.getTime()) / (1000 * 60 * 60 * 24));

    Object.entries(ranges).forEach(([key, range]) => {
      if (daysOld >= range.min && daysOld < range.max) {
        range.count += 1;
        range.total += e.amount;
      }
    });
  });

  return {
    type: "aged",
    agedBuckets: ranges,
  };
}

function generateTaxReport(expenses: any[]) {
  const byTaxType: Record<string, any> = {};

  expenses.forEach((e) => {
    if (!byTaxType[e.taxType]) {
      byTaxType[e.taxType] = {
        taxType: e.taxType,
        baseAmount: 0,
        taxAmount: 0,
        totalAmount: 0,
        count: 0,
      };
    }

    byTaxType[e.taxType].baseAmount += e.amount;
    byTaxType[e.taxType].taxAmount += e.taxAmount;
    byTaxType[e.taxType].totalAmount += e.totalAmount;
    byTaxType[e.taxType].count += 1;
  });

  const vat = byTaxType["VAT"] || { baseAmount: 0, taxAmount: 0, totalAmount: 0 };
  const wht = byTaxType["WHT"] || { baseAmount: 0, taxAmount: 0, totalAmount: 0 };

  return {
    type: "tax-summary",
    byTaxType: Object.values(byTaxType),
    totals: {
      totalVAT: Math.round(vat.taxAmount * 100) / 100,
      totalWHT: Math.round(wht.taxAmount * 100) / 100,
      combinedTax: Math.round((vat.taxAmount + wht.taxAmount) * 100) / 100,
    },
  };
}
