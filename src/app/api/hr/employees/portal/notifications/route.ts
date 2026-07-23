import { NextRequest, NextResponse } from "next/server";
import { resolveEmployeeSession } from "@/lib/hr/auth";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
} from "@/lib/hr/db";

/**
 * GET /api/hr/employees/portal/notifications
 * Returns notifications for the authenticated employee.
 * Query params: ?unread=true&limit=50
 */
export async function GET(request: NextRequest) {
  const session = resolveEmployeeSession(request);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get("unread") === "true";
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    const [notifications, unreadCount] = await Promise.all([
      listNotifications(session.tenantSlug, session.id, { unreadOnly, limit }),
      getUnreadNotificationCount(session.tenantSlug, session.id),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error: any) {
    console.error("Notifications GET error:", error?.message);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}

/**
 * PATCH /api/hr/employees/portal/notifications
 * Body: { notificationId?: string, markAll?: boolean }
 */
export async function PATCH(request: NextRequest) {
  const session = resolveEmployeeSession(request);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const body = await request.json();
    const { notificationId, markAll } = body;

    if (markAll) {
      await markAllNotificationsRead(session.tenantSlug, session.id);
      return NextResponse.json({ success: true });
    }

    if (notificationId) {
      await markNotificationRead(session.tenantSlug, notificationId, session.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Missing notificationId or markAll" }, { status: 400 });
  } catch (error: any) {
    console.error("Notifications PATCH error:", error?.message);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}
