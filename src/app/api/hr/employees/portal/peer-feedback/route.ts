import { NextRequest, NextResponse } from "next/server";
import { resolveEmployeeSession } from "@/lib/hr/auth";
import { ensureHrTables } from "@/lib/hr/db";
import {
  insertPeerFeedback,
  getPeerFeedbackForEmployee,
} from "@/lib/hr/db-appraisals";

export async function GET(request: NextRequest) {
  const session = resolveEmployeeSession(request);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(request.url);
  const employeeId = url.searchParams.get("employeeId");

  try {
    await ensureHrTables();
    if (!employeeId) {
      return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
    }
    const feedback = await getPeerFeedbackForEmployee(session.tenantSlug, employeeId);
    return NextResponse.json({ feedback });
  } catch (error: any) {
    console.error("Peer feedback GET error:", error?.message);
    return NextResponse.json({ error: "Failed to load peer feedback" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = resolveEmployeeSession(request);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    await ensureHrTables();
    const body = await request.json();
    const {
      employeeId,
      rating,
      collaborationScore,
      communicationScore,
      reliabilityScore,
      strengths,
      improvements,
      comments,
      period,
      isAnonymous,
    } = body;

    if (!employeeId || !rating) {
      return NextResponse.json({ error: "employeeId and rating are required" }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: "rating must be between 1 and 5" }, { status: 400 });
    }

    const id = await insertPeerFeedback({
      tenantSlug: session.tenantSlug,
      employeeId,
      reviewerId: session.id,
      reviewerName: isAnonymous ? "" : session.name,
      reviewerRole: session.role || "peer",
      rating: Math.round(rating),
      collaborationScore,
      communicationScore,
      reliabilityScore,
      strengths: strengths || [],
      improvements: improvements || [],
      comments: comments || "",
      period: period || "monthly",
      isAnonymous: isAnonymous ?? false,
    });

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error("Peer feedback POST error:", error?.message);
    return NextResponse.json({ error: "Failed to submit peer feedback" }, { status: 500 });
  }
}
