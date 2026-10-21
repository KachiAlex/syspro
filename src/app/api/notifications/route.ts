import { NextRequest, NextResponse } from "next/server";
import { requireTenantScope } from "@/lib/api-auth";
import {
  countUnreadAppNotifications,
  listAppNotifications,
  markAppNotificationsRead,
} from "@/lib/notify";

export const dynamic = "force-dynamic";

// The bell matches notifications keyed by session id OR email (explicit
// recipients can be keyed by either).
function userKeys(user: { id?: string | number; email?: string }) {
  return [String(user.id ?? ""), user.email ?? ""].filter(Boolean);
}

export async function GET(request: NextRequest) {
  const requested = new URL(request.url).searchParams.get("tenantSlug");
  const auth = await requireTenantScope(request, requested);
  if (!auth.ok) return auth.response;
  const tenantSlug = requested ?? auth.user.tenantSlug!;
  const keys = userKeys(auth.user);
  const [items, unread] = await Promise.all([
    listAppNotifications(tenantSlug, keys),
    countUnreadAppNotifications(tenantSlug, keys),
  ]);
  return NextResponse.json({ items, unread });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const requested = body.tenantSlug ?? null;
  const auth = await requireTenantScope(request, requested);
  if (!auth.ok) return auth.response;
  const tenantSlug = requested ?? auth.user.tenantSlug!;
  await markAppNotificationsRead(tenantSlug, userKeys(auth.user), body.ids);
  return NextResponse.json({ ok: true });
}
