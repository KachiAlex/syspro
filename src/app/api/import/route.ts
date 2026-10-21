export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { importCsv, listImportJobs, ImportEntity } from "@/lib/import/csv-import";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

const ENTITIES: ImportEntity[] = ["customers", "vendors", "products", "opening_balances"];

/**
 * CSV import.
 *   GET  /api/import                     → recent import jobs
 *   POST /api/import?entity=customers    → body { csv: "..." } or raw text/csv
 * Entities: customers | vendors | products | opening_balances
 * Header names are fuzzy-matched (name/customer_name, sku/code, debit/credit…).
 */
export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "admin", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  const jobs = await listImportJobs(context.tenantSlug);
  return NextResponse.json({ jobs });
}

export async function POST(request: NextRequest) {
  const gate = await requireModuleAccess(request, "admin", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const { searchParams } = new URL(request.url);
  const entity = searchParams.get("entity") as ImportEntity;
  if (!ENTITIES.includes(entity)) {
    return NextResponse.json(
      { error: `entity is required — one of: ${ENTITIES.join(", ")}` },
      { status: 400 }
    );
  }

  let csvText: string | null = null;
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
    csvText = await request.text();
  } else {
    const body = await request.json().catch(() => null);
    csvText = body?.csv ?? null;
  }
  if (!csvText?.trim()) {
    return NextResponse.json({ error: "No CSV data — send text/csv body or {csv: \"...\"}" }, { status: 400 });
  }

  const dryRun = searchParams.get("dryRun") === "1" || searchParams.get("dryRun") === "true";
  try {
    const result = await importCsv(context.tenantSlug, entity, csvText, {
      createdBy: (context as any).userId ?? undefined,
      dryRun,
    });
    return NextResponse.json(result, { status: result.failed > 0 && result.imported === 0 ? 422 : 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 422 });
  }
}
