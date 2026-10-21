import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantScope } from "@/lib/api-auth";
import { getNotificationPreferences, saveNotificationPreferences } from "@/lib/notify";

export const dynamic = "force-dynamic";

const prefSchema = z.object({
  emailEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
  frequency: z.enum(["immediate", "daily"]),
  quietStart: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  quietEnd: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  quietTz: z.string().nullish(),
});

export async function GET(request: NextRequest) {
  const requested = new URL(request.url).searchParams.get("tenantSlug");
  const auth = await requireTenantScope(request, requested);
  if (!auth.ok) return auth.response;
  const tenantSlug = requested ?? auth.user.tenantSlug!;
  return NextResponse.json({
    preferences: await getNotificationPreferences(tenantSlug, String(auth.user.id)),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const requested = body?.tenantSlug ?? null;
  const auth = await requireTenantScope(request, requested);
  if (!auth.ok) return auth.response;
  const parsed = prefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid preferences", details: parsed.error.issues }, { status: 400 });
  }
  await saveNotificationPreferences({
    tenantSlug: requested ?? auth.user.tenantSlug!,
    userId: String(auth.user.id),
    ...parsed.data,
  });
  return NextResponse.json({ ok: true });
}
