import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantScope } from "@/lib/api-auth";
import { listNotificationRules, upsertNotificationRule } from "@/lib/notify";

export const dynamic = "force-dynamic";

const ruleSchema = z.object({
  tenantSlug: z.string().min(1),
  eventType: z.string().min(1),
  channels: z.array(z.enum(["email", "in_app"])).min(1),
  recipients: z.array(
    z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("role"), value: z.string() }),
      z.object({ kind: z.literal("user"), value: z.string() }),
      z.object({ kind: z.literal("party") }),
      z.object({ kind: z.literal("emails"), value: z.array(z.string().email()) }),
      z.object({ kind: z.literal("admin") }),
    ])
  ),
  enabled: z.boolean(),
  subjectOverride: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const requested = new URL(request.url).searchParams.get("tenantSlug");
  const auth = await requireTenantScope(request, requested);
  if (!auth.ok) return auth.response;
  const tenantSlug = requested ?? auth.user.tenantSlug!;
  return NextResponse.json({ rules: await listNotificationRules(tenantSlug) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const auth = await requireTenantScope(request, body?.tenantSlug ?? null);
  if (!auth.ok) return auth.response;
  const parsed = ruleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid rule", details: parsed.error.issues }, { status: 400 });
  const { tenantSlug, ...rule } = parsed.data;
  await upsertNotificationRule({ tenantSlug, ...rule });
  return NextResponse.json({ ok: true });
}
