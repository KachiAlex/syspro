export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/api-auth";
import { sql as SQL, db } from "@/lib/sql-client";
import { checkRateLimitAsync, getRateLimitKey } from "@/lib/rate-limit";

/** Columns never exported — credentials, tokens, session material. */
const SENSITIVE_COL = /password|token|secret|session|api_key|apikey|otp|pin|credential|hash/i;
const ROW_CAP = 50000;

/**
 * GET /api/tenant/export — full tenant data export as a single JSON file.
 * Standards/portability feature: a tenant can download everything the
 * platform holds for them (audit requests, exit rights, migrations).
 * Admin-level only, rate limited.
 */
export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "admin", "write");
  if (!gate.ok) return gate.response;
  const tenantSlug = gate.user.tenantSlug!;

  const rateKey = `tenant-export:${tenantSlug}:${getRateLimitKey(request)}`;
  const { allowed, retryAfter } = await checkRateLimitAsync(rateKey, 2, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: `Export already in progress or rate-limited. Retry in ${retryAfter}s.` }, { status: 429 });
  }

  try {
    const tables = await SQL`
      select table_name from information_schema.columns
      where table_schema = 'public' and column_name = 'tenant_slug'
      group by table_name order by table_name
    `;

    const out: Record<string, { columns: string[]; rows: any[]; truncated?: boolean }> = {};
    for (const t of tables as any[]) {
      const name = t.table_name as string;
      try {
        const cols = await SQL`
          select column_name from information_schema.columns
          where table_schema = 'public' and table_name = ${name}
          order by ordinal_position
        `;
        const keep = (cols as any[]).map((c) => c.column_name).filter((c) => !SENSITIVE_COL.test(c));
        if (keep.length === 0) continue;
        const colList = keep.map((c) => `"${c}"`).join(", ");
        const { rows } = await db.query(
          `select ${colList} from "${name}" where tenant_slug = $1 limit $2`,
          [tenantSlug, ROW_CAP + 1]
        );
        const truncated = rows.length > ROW_CAP;
        out[name] = { columns: keep, rows: rows.slice(0, ROW_CAP), ...(truncated ? { truncated: true } : {}) };
      } catch (e) {
        console.error(`export: skipping table ${name}:`, (e as any)?.message);
      }
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      tenantSlug,
      tableCount: Object.keys(out).length,
      note: "Sensitive credential columns (passwords, tokens, secrets) are excluded.",
      tables: out,
    };

    return new NextResponse(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${tenantSlug}-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    console.error("Tenant export failed:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
