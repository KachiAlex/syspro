export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import {
  generatePayeRemittance,
  generateVatSummary,
  generateWhtSchedule,
} from "@/lib/finance/localization";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

function toCsv(rows: Record<string, any>[], headers?: string[]): string {
  if (rows.length === 0) return headers ? headers.join(",") + "\n" : "";
  const cols = headers ?? Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => esc(r[c])).join(",")),
  ].join("\n") + "\n";
}

function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function flatten(obj: Record<string, any>, prefix = ""): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}_${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = Array.isArray(v) ? JSON.stringify(v) : v;
    }
  }
  return out;
}

/**
 * Statutory reports.
 *   ?type=vat&from=2026-01-01&to=2026-12-31   → VAT return summary (output − input)
 *   ?type=wht&from=...&to=...                → WHT withheld schedule
 *   ?type=paye[&periods=12]                  → PAYE/pension/NHF remittance schedule
 *   &format=csv                              → filing-format CSV export
 */
export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "vat";
    const format = url.searchParams.get("format");
    const year = new Date().getFullYear();
    const start = url.searchParams.get("from") || `${year}-01-01`;
    const end = url.searchParams.get("to") || `${year}-12-31`;

    switch (type) {
      case "vat": {
        const data = await generateVatSummary(context.tenantSlug, start, end);
        if (format === "csv") {
          const rows = data.monthly.map((m) => flatten(m as any));
          rows.push({
            month: "TOTAL",
            output: data.outputVat.taxAmount,
            input: data.inputVat.taxAmount,
            net: data.netPayable,
          });
          return csvResponse(toCsv(rows), `vat-return-${start}_${end}.csv`);
        }
        return NextResponse.json(data);
      }
      case "wht": {
        const data = await generateWhtSchedule(context.tenantSlug, start, end);
        if (format === "csv") {
          const rows = data.lines.map((r) => flatten(r as any));
          rows.push({ date: "TOTAL", description: "", base: data.totalBase, rate: "", wht: data.totalWht });
          return csvResponse(toCsv(rows), `wht-schedule-${start}_${end}.csv`);
        }
        return NextResponse.json(data);
      }
      case "paye": {
        const periods = url.searchParams.get("periods");
        const data = await generatePayeRemittance(
          context.tenantSlug,
          periods ? Number(periods) : undefined
        );
        if (format === "csv") {
          const rows = data.periods.map((r) => flatten(r as any));
          rows.push({
            period: "TOTAL",
            employees: "",
            gross: "",
            paye: data.totals.paye,
            pensionEmployee: "",
            pensionEmployer: "",
            nhf: data.totals.nhf,
            otherStatutory: "",
            employerCost: data.totals.employerCost,
            net: "",
          });
          return csvResponse(toCsv(rows), `paye-remittance.csv`);
        }
        return NextResponse.json(data);
      }
      default:
        return NextResponse.json(
          { error: `Unknown statutory report type "${type}" — use vat|wht|paye` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
