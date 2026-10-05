import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { sql } from "@/lib/sql-client";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";
import { z } from "zod";

export const dynamic = "force-dynamic";

const DEFAULT_PREFERENCES = {
  email: true,
  push: true,
  inApp: true,
  categories: {
    system: true,
    crm: true,
    finance: true,
    hr: true,
    projects: true,
    security: true,
    general: true,
  },
  quietHours: {
    enabled: false,
    start: "22:00",
    end: "08:00",
    timezone: "UTC",
  },
};

const PreferencesSchema = z.object({
  email: z.boolean().optional(),
  push: z.boolean().optional(),
  inApp: z.boolean().optional(),
  categories: z.record(z.boolean()).optional(),
  quietHours: z
    .object({
      enabled: z.boolean().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      timezone: z.string().optional(),
    })
    .optional(),
});

function getIdentity(request: NextRequest) {
  const session =
    verifySession(request.cookies.get("pisairtel_session")?.value || "") ||
    verifySession(request.cookies.get("employee_session")?.value || "");
  if (!session?.id) return null;
  return {
    userId: session.id,
    tenantSlug: session.tenantSlug || request.cookies.get("tenantSlug")?.value || "",
  };
}

/**
 * GET /api/user/notifications/preferences
 * Returns the current user's notification preferences.
 */
export async function GET(request: NextRequest) {
  const identity = getIdentity(request);
  if (!identity) {
    return NextResponse.json(DEFAULT_PREFERENCES, { status: 200 });
  }

  try {
    await ensureTenantTable(sql);
    const rows = await sql`
      select preferences from user_notification_preferences
      where user_id = ${identity.userId}
      limit 1
    `;
    const stored = rows[0]?.preferences;
    const prefs = stored
      ? typeof stored === "string"
        ? JSON.parse(stored)
        : stored
      : {};
    return NextResponse.json({
      ...DEFAULT_PREFERENCES,
      ...prefs,
      categories: { ...DEFAULT_PREFERENCES.categories, ...(prefs.categories || {}) },
      quietHours: { ...DEFAULT_PREFERENCES.quietHours, ...(prefs.quietHours || {}) },
    });
  } catch (error) {
    console.error("Failed to load notification preferences:", error);
    return NextResponse.json(DEFAULT_PREFERENCES, { status: 200 });
  }
}

/**
 * PATCH /api/user/notifications/preferences
 * Merge-saves a partial preferences payload for the current user.
 */
export async function PATCH(request: NextRequest) {
  const identity = getIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = PreferencesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid preferences", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    await ensureTenantTable(sql);
    const rows = await sql`
      select preferences from user_notification_preferences
      where user_id = ${identity.userId}
      limit 1
    `;
    const stored = rows[0]?.preferences;
    const current = stored ? (typeof stored === "string" ? JSON.parse(stored) : stored) : {};

    const merged = {
      ...DEFAULT_PREFERENCES,
      ...current,
      ...parsed.data,
      categories: {
        ...DEFAULT_PREFERENCES.categories,
        ...(current.categories || {}),
        ...(parsed.data.categories || {}),
      },
      quietHours: {
        ...DEFAULT_PREFERENCES.quietHours,
        ...(current.quietHours || {}),
        ...(parsed.data.quietHours || {}),
      },
    };

    await sql`
      insert into user_notification_preferences (user_id, tenant_slug, preferences, updated_at)
      values (${identity.userId}, ${identity.tenantSlug}, ${JSON.stringify(merged)}, now())
      on conflict (user_id) do update set
        preferences = ${JSON.stringify(merged)}::jsonb,
        updated_at = now()
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save notification preferences:", error);
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }
}
