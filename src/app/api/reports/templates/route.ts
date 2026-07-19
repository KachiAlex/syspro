import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";

const TEMPLATES: Record<string, any[]> = {
  financial: [
    { id: "fin-1", name: "Revenue Summary", description: "Total revenue and growth across periods", module: "financial", type: "revenue", defaultFormat: "csv", filters: [{ key: "period", label: "Period", type: "select", options: ["monthly", "quarterly", "yearly"] }] },
    { id: "fin-2", name: "Profit & Loss", description: "Income minus expenses", module: "financial", type: "profit-loss", defaultFormat: "excel", filters: [{ key: "period", label: "Period", type: "select", options: ["monthly", "quarterly", "yearly"] }] },
    { id: "fin-3", name: "Cash Flow", description: "Cash inflows and outflows", module: "financial", type: "cash-flow", defaultFormat: "csv", filters: [{ key: "period", label: "Period", type: "select", options: ["monthly", "quarterly", "yearly"] }] },
    { id: "fin-4", name: "Budget vs Actual", description: "Compare budget to actuals", module: "financial", type: "budget", defaultFormat: "pdf", filters: [{ key: "period", label: "Period", type: "select", options: ["monthly", "quarterly", "yearly"] }] },
  ],
  sales: [
    { id: "sales-1", name: "Sales Performance", description: "Revenue and deals closed", module: "sales", type: "performance", defaultFormat: "csv", filters: [{ key: "period", label: "Period", type: "select", options: ["monthly", "quarterly", "yearly"] }] },
    { id: "sales-2", name: "Customer Acquisition", description: "New customers and conversion", module: "sales", type: "acquisition", defaultFormat: "csv", filters: [{ key: "channel", label: "Channel", type: "select", options: ["all", "organic", "paid", "referral"] }] },
    { id: "sales-3", name: "Pipeline Analysis", description: "Deals by stage and forecast", module: "sales", type: "pipeline", defaultFormat: "excel", filters: [{ key: "stage", label: "Stage", type: "select", options: ["all", "lead", "qualified", "proposal", "closed"] }] },
    { id: "sales-4", name: "Revenue Forecast", description: "Projected revenue", module: "sales", type: "forecast", defaultFormat: "pdf", filters: [{ key: "period", label: "Period", type: "select", options: ["monthly", "quarterly", "yearly"] }] },
  ],
  hr: [
    { id: "hr-1", name: "Employee Performance", description: "Performance metrics by employee", module: "hr", type: "performance", defaultFormat: "csv", filters: [{ key: "department", label: "Department", type: "select", options: ["all"] }] },
    { id: "hr-2", name: "Attendance Analysis", description: "Attendance and absence trends", module: "hr", type: "attendance", defaultFormat: "csv", filters: [{ key: "period", label: "Period", type: "select", options: ["monthly", "quarterly", "yearly"] }] },
    { id: "hr-3", name: "Payroll Cost", description: "Payroll and compensation", module: "hr", type: "payroll", defaultFormat: "excel", filters: [{ key: "period", label: "Period", type: "select", options: ["monthly", "quarterly", "yearly"] }] },
    { id: "hr-4", name: "Training Effectiveness", description: "Training completion and impact", module: "hr", type: "training", defaultFormat: "pdf", filters: [{ key: "period", label: "Period", type: "select", options: ["monthly", "quarterly", "yearly"] }] },
  ],
};

export async function GET(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");
    const module = new URL(request.url).searchParams.get("module");
    const templates = module && TEMPLATES[module] ? TEMPLATES[module] : Object.values(TEMPLATES).flat();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Templates fetch failed", error);
    const message = error instanceof Error ? error.message : "Unable to fetch templates";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
