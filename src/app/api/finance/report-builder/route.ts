export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  saveCustomReport, listCustomReports, getCustomReport,
  deleteCustomReport, runCustomReport, listReportTables,
} from "@/lib/reports/builder";

const filterSchema = z.object({
  field: z.string(), op: z.string(), value: z.any().optional(),
});

const saveSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  tableName: z.string(),
  columns: z.array(z.string()).default([]),
  filters: z.array(filterSchema).optional(),
  sort: z.object({ field: z.string(), dir: z.string().optional() }).optional(),
  limit: z.number().optional(),
  isShared: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const sp = request.nextUrl.searchParams;
  if (sp.get("tables")) return NextResponse.json({ tables: listReportTables() });
  if (sp.get("id")) {
    const r = await getCustomReport(context.tenantSlug, sp.get("id")!);
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ report: r });
  }
  return NextResponse.json({ reports: await listCustomReports(context.tenantSlug) });
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  const body = await request.json();

  // Ad-hoc run — no save
  if (body.action === "run") {
    try {
      const result = await runCustomReport({ tenantSlug: context.tenantSlug, ...body });
      return NextResponse.json(result);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }
  // Run a saved report by id
  if (body.action === "runSaved" && body.id) {
    const r = await getCustomReport(context.tenantSlug, body.id);
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
    try {
      const result = await runCustomReport({
        tenantSlug: context.tenantSlug,
        tableName: r.table_name,
        columns: Array.isArray(r.columns) ? r.columns : JSON.parse(r.columns),
        filters: Array.isArray(r.filters) ? r.filters : JSON.parse(r.filters ?? "[]"),
        sort: r.sort ? (typeof r.sort === "string" ? JSON.parse(r.sort) : r.sort) : undefined,
        limit: r.row_limit,
      });
      return NextResponse.json(result);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }

  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  try {
    const r = await saveCustomReport({
      tenantSlug: context.tenantSlug,
      createdBy: context.userId ?? "unknown",
      ...parsed.data,
    });
    return NextResponse.json({ report: r }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteCustomReport(context.tenantSlug, id);
  return NextResponse.json({ ok: true });
}
