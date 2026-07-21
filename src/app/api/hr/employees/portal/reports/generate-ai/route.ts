import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("employee_session")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const session = decodeEmployeeToken(token);
  if (!session) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return NextResponse.json({
      error: "AI feature is not configured. Please set GROQ_API_KEY environment variable.",
      hint: "Get a free API key at https://console.groq.com/keys",
    }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { transcript, reportType, reportDate, kpiContext, templateSections } = body;

    if (!transcript || typeof transcript !== "string" || transcript.trim().length < 10) {
      return NextResponse.json({ error: "Transcript is too short. Please dictate or type at least a few sentences." }, { status: 400 });
    }

    if (!reportType || !["daily", "weekly", "monthly", "quarterly", "annual"].includes(reportType)) {
      return NextResponse.json({ error: "Valid report type is required" }, { status: 400 });
    }

    // Build KPI context string
    let kpiContextStr = "";
    if (kpiContext && kpiContext.length > 0) {
      kpiContextStr = "\n\nThe employee has the following KPIs assigned:\n";
      kpiContextStr += kpiContext.map((k: any, i: number) =>
        `${i + 1}. ${k.title}${k.description ? ` — ${k.description}` : ""}${k.expected_outcome ? ` (Expected: ${k.expected_outcome})` : ""}`
      ).join("\n");
      kpiContextStr += "\n\nIf the employee mentions progress on any of these KPIs, extract the metrics and populate the kpiMetrics array.";
    }

    // Build template context
    let templateStr = "";
    if (templateSections && templateSections.length > 0) {
      templateStr = "\n\nThe report should follow this template structure:\n";
      templateStr += templateSections.map((s: any) => `- ${s.name || s.title}: ${s.prompt || s.description || ""}`).join("\n");
    }

    const isSectioned = body.sectioned === true;

    const sectionedInstructions = isSectioned
      ? `The transcript is already organized into labeled sections (e.g., [ACTIVITIES], [ACHIEVEMENTS], etc.). For each section:
- Refine the spoken/casual language into clear, professional business writing
- Fix grammar, remove filler words (um, uh, like, you know), and organize into logical sentences
- Use bullet points for lists of items
- Keep all meaningful content — don't drop details the employee mentioned
- If a section is empty or missing, return an empty string for that field
- You may pull relevant content from one section into another if it clearly belongs there (e.g., an achievement mentioned in the activities section)

`
      : "";

    const systemPrompt = `You are a professional report writing assistant for an employee portal. Your job is to take a raw transcript (from voice dictation or typed text) and transform it into a well-structured, professional ${reportType} report.

${sectionedInstructions}The report must include these fields:
1. title — A concise, professional title for the report (e.g., "Daily Activity Report — July 21, 2026")
2. objectives — What the employee aimed to achieve during this period
3. achievements — What was accomplished (milestones, deliverables, successes)
4. challenges — Any difficulties encountered (if none, return empty string)
5. next_steps — Planned next actions (if none mentioned, infer from context)
6. meetings — Any meetings attended (if none, return empty string)
7. blockers — Anything blocking progress (if none, return empty string)
8. activities — Key activities performed (list format with bullet points)
9. additional_notes — Any other relevant information not captured above
10. kpiMetrics — Array of objects with {name, target, actual, status} for any KPI progress mentioned

Rules:
- Convert casual/spoken language into professional business writing
- Be concise but thorough — preserve ALL meaningful information from the transcript
- Use bullet points where appropriate (use • character)
- If a field has no relevant content from the transcript, return an empty string
- For kpiMetrics, only include entries if the transcript mentions specific metrics or KPI progress
- The status for kpiMetrics should be one of: "on_track", "ahead", "behind", "not_started"
- Maintain the employee's original meaning — don't exaggerate or downplay
- Fix transcription errors contextually (e.g., "financing report" → "financial report", "procurement" if clearly meant)

You MUST respond with ONLY a valid JSON object, no markdown, no explanation. The JSON must have exactly these keys:
{"title":"","objectives":"","achievements":"","challenges":"","next_steps":"","meetings":"","blockers":"","activities":"","additional_notes":"","kpiMetrics":[]}`;

    const userPrompt = `Please convert the following ${reportType} report transcript into a structured report${templateStr}${kpiContextStr}

Report date: ${reportDate || new Date().toISOString().split("T")[0]}

TRANSCRIPT:
"""
${transcript}
"""

Return ONLY the JSON object:`;

    const messages: GroqMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const groqRes = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => "");
      console.error("Groq API error:", groqRes.status, errText);
      if (groqRes.status === 429) {
        return NextResponse.json({ error: "AI rate limit reached. Please try again in a minute." }, { status: 429 });
      }
      return NextResponse.json({ error: "AI service error. Please try again." }, { status: 502 });
    }

    const groqData = await groqRes.json();
    const content = groqData?.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: "AI returned no content. Please try again." }, { status: 502 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch {
          return NextResponse.json({ error: "AI returned invalid format. Please try again." }, { status: 502 });
        }
      } else {
        return NextResponse.json({ error: "AI returned invalid format. Please try again." }, { status: 502 });
      }
    }

    // Validate and sanitize the parsed output
    const result = {
      title: typeof parsed.title === "string" ? parsed.title : "",
      objectives: typeof parsed.objectives === "string" ? parsed.objectives : "",
      achievements: typeof parsed.achievements === "string" ? parsed.achievements : "",
      challenges: typeof parsed.challenges === "string" ? parsed.challenges : "",
      next_steps: typeof parsed.next_steps === "string" ? parsed.next_steps : "",
      meetings: typeof parsed.meetings === "string" ? parsed.meetings : "",
      blockers: typeof parsed.blockers === "string" ? parsed.blockers : "",
      activities: typeof parsed.activities === "string" ? parsed.activities : "",
      additional_notes: typeof parsed.additional_notes === "string" ? parsed.additional_notes : "",
      kpiMetrics: Array.isArray(parsed.kpiMetrics) ? parsed.kpiMetrics.map((m: any) => ({
        name: typeof m.name === "string" ? m.name : "",
        target: typeof m.target === "string" ? m.target : "",
        actual: typeof m.actual === "string" ? m.actual : "",
        status: ["on_track", "ahead", "behind", "not_started"].includes(m.status) ? m.status : "not_started",
      })).filter((m: any) => m.name) : [],
      raw_transcript: transcript,
    };

    return NextResponse.json({ success: true, report: result });
  } catch (error: any) {
    console.error("AI report generation error:", error?.message || error);
    return NextResponse.json({ error: "Failed to generate report", detail: error?.message || String(error) }, { status: 500 });
  }
}
