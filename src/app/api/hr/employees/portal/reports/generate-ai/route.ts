import { NextRequest, NextResponse } from "next/server";
import { resolveEmployeeSession } from "@/lib/hr/auth";
import { runAgent } from "@/lib/ai/agent";

export async function POST(request: NextRequest) {
  const session = resolveEmployeeSession(request);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return NextResponse.json({
      error: "AI feature is not configured. Please set GROQ_API_KEY environment variable.",
      hint: "Get a free API key at https://console.groq.com/keys",
    }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { transcript, reportType, reportDate, kpiContext, templateSections, sectioned } = body;

    if (!transcript || typeof transcript !== "string" || transcript.trim().length < 10) {
      return NextResponse.json({ error: "Transcript is too short. Please dictate or type at least a few sentences." }, { status: 400 });
    }

    if (!reportType || !["daily", "weekly", "monthly", "quarterly", "annual"].includes(reportType)) {
      return NextResponse.json({ error: "Valid report type is required" }, { status: 400 });
    }

    const agentResponse = await runAgent({
      capability: "generate_report",
      payload: { transcript, reportType, reportDate, kpiContext, templateSections, sectioned },
      tenantSlug: session.tenantSlug,
      useAI: true,
    });

    if (!agentResponse.success) {
      return NextResponse.json({ error: agentResponse.error ?? "Failed to generate report" }, { status: 500 });
    }

    return NextResponse.json({ success: true, report: agentResponse.result, metadata: agentResponse.metadata });
  } catch (error: any) {
    console.error("AI report generation error:", error?.message || error);
    return NextResponse.json({ error: "Failed to generate report", detail: error?.message || String(error) }, { status: 500 });
  }
}
