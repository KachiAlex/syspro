import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantScope } from "@/lib/api-auth";
import {
  listNotificationTemplates,
  upsertNotificationTemplate,
  deleteNotificationTemplate,
} from "@/lib/notify";

export const dynamic = "force-dynamic";

const templateSchema = z.object({
  tenantSlug: z.string().min(1),
  eventType: z.string().min(1),
  subjectTemplate: z.string().max(300).optional().nullable(),
  bodyTemplate: z.string().min(1).max(10000),
});

export async function GET(request: NextRequest) {
  const requested = new URL(request.url).searchParams.get("tenantSlug");
  const auth = await requireTenantScope(request, requested);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ templates: await listNotificationTemplates(requested ?? auth.user.tenantSlug!) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const auth = await requireTenantScope(request, body?.tenantSlug ?? null);
  if (!auth.ok) return auth.response;
  const parsed = templateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid template", details: parsed.error.issues }, { status: 400 });
  await upsertNotificationTemplate(parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  const eventType = url.searchParams.get("eventType");
  const auth = await requireTenantScope(request, tenantSlug);
  if (!auth.ok) return auth.response;
  if (!eventType) return NextResponse.json({ error: "eventType is required" }, { status: 400 });
  const ok = await deleteNotificationTemplate(tenantSlug ?? auth.user.tenantSlug!, eventType);
  if (!ok) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
