import { NextRequest, NextResponse } from "next/server";
import { getChartOfAccounts, ensureAccountingTables } from "@/lib/finance/accounting";
import { sql as SQL } from "@/lib/sql-client";
import { requireModuleAccess } from "@/lib/api-auth";
import { getPagination } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  const scope = await requireModuleAccess(request, "finance", "read");
  if (!scope.ok) return scope.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantSlug = searchParams.get("tenantSlug")!;

    await ensureAccountingTables(SQL);
    const accounts = await getChartOfAccounts(tenantSlug);

    // Paginate before the per-account balance loop to cap query count
    const { limit, offset } = getPagination(request);
    const page = accounts.slice(offset, offset + limit);

    const accountsWithBalance = await Promise.all(
      page.map(async (acc) => {
        const balanceRows = (await SQL`
          select
            coalesce(sum(jel.debit_amount), 0) as total_debit,
            coalesce(sum(jel.credit_amount), 0) as total_credit
          from journal_entry_lines jel
          join journal_entries je on jel.entry_id = je.id
          where je.tenant_slug = ${tenantSlug} and jel.account_code = ${acc.code}
        `) as any[];
        const balance = (balanceRows[0]?.total_debit || 0) - (balanceRows[0]?.total_credit || 0);
        return { ...acc, balance };
      })
    );

    return NextResponse.json({ success: true, data: accountsWithBalance });
  } catch (error) {
    console.error("Error fetching chart of accounts:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
