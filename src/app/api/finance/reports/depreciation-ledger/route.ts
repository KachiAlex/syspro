export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  assetDepreciationLedger,
  assetDepreciationsAndBalances,
} from "@/lib/finance/asset-lifecycle";
import { requireModuleAccess } from "@/lib/api-auth";

function escCsv(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantSlug = searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }
    const variant = searchParams.get("variant") ?? "ledger";

    if (variant === "balances") {
      const data = await assetDepreciationsAndBalances({
        tenantSlug,
        financeBook: searchParams.get("financeBook") ?? undefined,
      });
      if (searchParams.get("format") === "csv") {
        const headers = ["Asset", "Name", "Category", "Location", "Cost", "Accum Dep", "NBV", "Status"];
        const rows = data.map((r) => [r.assetNo, r.assetName, r.category ?? "", r.location ?? "", r.cost.toFixed(2), r.accumulatedDepreciation.toFixed(2), r.netBookValue.toFixed(2), r.status]);
        return new NextResponse([headers, ...rows].map((r) => r.map(escCsv).join(",")).join("\n"), {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="asset-balances-${new Date().toISOString().split("T")[0]}.csv"`,
          },
        });
      }
      return NextResponse.json({ success: true, data });
    }

    const data = await assetDepreciationLedger({
      tenantSlug,
      assetId: searchParams.get("assetId") ?? undefined,
      periodStart: searchParams.get("startDate") ?? undefined,
      periodEnd: searchParams.get("endDate") ?? undefined,
      financeBook: searchParams.get("financeBook") ?? undefined,
    });
    if (searchParams.get("format") === "csv") {
      const headers = ["Asset", "Name", "Period", "Opening NBV", "Depreciation", "Closing NBV", "Status", "Finance Book", "JE"];
      const rows = data.map((r) => [r.assetNo, r.assetName, r.periodDate, r.openingNbv.toFixed(2), r.depreciation.toFixed(2), r.closingNbv.toFixed(2), r.status, r.financeBook, r.journalEntryId ?? ""]);
      return new NextResponse([headers, ...rows].map((r) => r.map(escCsv).join(",")).join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="depreciation-ledger-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Depreciation ledger error:", error);
    return NextResponse.json(
      { success: false, error: (error as any)?.message ?? "Internal server error" },
      { status: (error as any)?.status ?? 500 },
    );
  }
}
