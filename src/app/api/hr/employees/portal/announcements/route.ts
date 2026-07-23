import { NextRequest, NextResponse } from "next/server";
import { resolveEmployeeSession } from "@/lib/hr/auth";
import { listAnnouncements, insertAnnouncement, deleteAnnouncement } from "@/lib/hr/db";

/**
 * GET /api/hr/employees/portal/announcements
 * Returns active announcements for the employee.
 */
export async function GET(request: NextRequest) {
  const session = resolveEmployeeSession(request);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const announcements = await listAnnouncements(session.tenantSlug, { activeOnly: true, limit: 10 });
    return NextResponse.json({ announcements });
  } catch (error: any) {
    console.error("Announcements GET error:", error?.message);
    return NextResponse.json({ error: "Failed to load announcements" }, { status: 500 });
  }
}

/**
 * POST /api/hr/employees/portal/announcements
 * Create announcement (HOD/HR/Admin only)
 */
export async function POST(request: NextRequest) {
  const session = resolveEmployeeSession(request);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const role = (session.role || "staff").toLowerCase();
  const canCreate = ["hod", "head_of_department", "hr", "hr_admin", "hr_manager", "admin"].includes(role);
  if (!canCreate) {
    return NextResponse.json({ error: "Only HODs, HR, and admins can create announcements" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { title, message, audience, targetId, priority, expiresAt } = body;

    if (!title?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "Title and message are required" }, { status: 400 });
    }

    const id = await insertAnnouncement({
      tenantSlug: session.tenantSlug,
      title: title.trim(),
      message: message.trim(),
      audience: audience || "all",
      targetId: targetId || null,
      priority: priority || "medium",
      createdBy: session.id,
      createdByName: session.name || null,
      expiresAt: expiresAt || null,
    });

    return NextResponse.json({ id, success: true });
  } catch (error: any) {
    console.error("Announcements POST error:", error?.message);
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
  }
}

/**
 * DELETE /api/hr/employees/portal/announcements?id=...
 */
export async function DELETE(request: NextRequest) {
  const session = resolveEmployeeSession(request);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const role = (session.role || "staff").toLowerCase();
  const canDelete = ["hod", "head_of_department", "hr", "hr_admin", "hr_manager", "admin"].includes(role);
  if (!canDelete) {
    return NextResponse.json({ error: "Only HODs, HR, and admins can delete announcements" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing announcement id" }, { status: 400 });

    await deleteAnnouncement(session.tenantSlug, id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Announcements DELETE error:", error?.message);
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 });
  }
}
