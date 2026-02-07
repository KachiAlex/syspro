import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

let REPORTS = [
  { id: "rep-1", tenantSlug: "kreatix-default", name: "Monthly Sales", type: "sales", period: "2026-01", createdAt: "2026-01-31", status: "ready" },
  { id: "rep-2", tenantSlug: "kreatix-default", name: "Headcount Trend", type: "hr", period: "2026-Q1", createdAt: "2026-01-30", status: "generating" },
];

let EXPORTS = [
  { id: "exp-1", tenantSlug: "kreatix-default", reportId: "rep-1", format: "csv", scheduledFor: null, status: "ready" },
];

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug") ?? "kreatix-default";
    return NextResponse.json({
      reports: REPORTS.filter((r) => r.tenantSlug === tenantSlug),
      exports: EXPORTS.filter((e) => e.tenantSlug === tenantSlug),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug") ?? "kreatix-default";
    const body = await request.json().catch(() => ({}));
    if (body.type === "report") {
      const report = {
        id: `rep-${randomUUID().slice(0, 6)}`,
        tenantSlug,
        name: body.name ?? "New Report",
        type: body.reportType ?? "custom",
        period: body.period ?? new Date().toISOString().slice(0, 7),
        createdAt: new Date().toISOString(),
        status: "generating",
      };
      REPORTS = [report, ...REPORTS];
      return NextResponse.json({ report });
    }
    if (body.type === "export") {
      const exp = {
        id: `exp-${randomUUID().slice(0, 6)}`,
        tenantSlug,
        reportId: body.reportId ?? "unknown",
        format: body.format ?? "csv",
        scheduledFor: body.scheduledFor ?? null,
        status: "queued",
      };
      EXPORTS = [exp, ...EXPORTS];
      return NextResponse.json({ export: exp });
    }
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug") ?? "kreatix-default";
    const body = await request.json().catch(() => ({}));
    if (body.reportId) {
      REPORTS = REPORTS.map((r) => (r.id === body.reportId && r.tenantSlug === tenantSlug ? { ...r, ...body.updates } : r));
      return NextResponse.json({ success: true });
    }
    if (body.exportId) {
      EXPORTS = EXPORTS.map((e) => (e.id === body.exportId && e.tenantSlug === tenantSlug ? { ...e, ...body.updates } : e));
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug") ?? "kreatix-default";
    const id = url.searchParams.get("id");
    const type = url.searchParams.get("type");
    if (type === "report" && id) {
      REPORTS = REPORTS.filter((r) => !(r.id === id && r.tenantSlug === tenantSlug));
      return NextResponse.json({ success: true });
    }
    if (type === "export" && id) {
      EXPORTS = EXPORTS.filter((e) => !(e.id === id && e.tenantSlug === tenantSlug));
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
