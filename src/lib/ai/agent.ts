/**
 * Unified AI Agent Core
 *
 * Single entry point for all AI capabilities in the system.
 * Routes requests to specialized handlers based on capability.
 * Uses Groq (llama-3.3-70b-versatile) as the unified LLM provider.
 * Falls back to deterministic methods when AI is unavailable.
 *
 * Capabilities:
 *  - screen_candidates  : Talent acquisition — score & rank job applicants
 *  - generate_report    : Report generation — convert transcripts to structured reports
 *  - appraise_performance: Productivity appraisal — evaluate employee performance
 *
 * External systems can call the agent via /api/ai/agent with an API key,
 * or connect via MCP at /api/ai/agent/mcp.
 */

// ─── Types ───

export type AgentCapability =
  | "screen_candidates"
  | "generate_report"
  | "appraise_performance";

export interface AgentRequest {
  capability: AgentCapability;
  payload: Record<string, unknown>;
  tenantSlug: string;
  useAI?: boolean;
}

export interface AgentResponse {
  success: boolean;
  capability: AgentCapability;
  result: unknown;
  metadata: {
    source: "ai" | "deterministic" | "heuristic";
    model: string | null;
    generatedAt: string;
    durationMs: number;
  };
  error?: string;
}

export interface AgentCapabilityDef {
  name: AgentCapability;
  description: string;
  inputSchema: Record<string, { type: string; required: boolean; description: string }>;
  outputDescription: string;
}

// ─── Capability Definitions (for MCP tool exposure) ───

export const CAPABILITY_DEFINITIONS: AgentCapabilityDef[] = [
  {
    name: "screen_candidates",
    description:
      "Score and rank job applicants for a requisition using AI-enhanced screening. " +
      "Evaluates skills match, experience, education, and certifications against job requirements. " +
      "Returns ranked list with scores, breakdowns, and shortlist recommendations.",
    inputSchema: {
      requisitionId: { type: "string", required: true, description: "The job requisition ID" },
      selectionMode: { type: "string", required: false, description: "'percentage' or 'fixed_number'" },
      selectionValue: { type: "number", required: false, description: "Percentage or count for shortlist" },
      minScoreThreshold: { type: "number", required: false, description: "Minimum score (0-100) to shortlist" },
    },
    outputDescription: "Ranked candidate list with AI scores, breakdowns, and shortlist status",
  },
  {
    name: "generate_report",
    description:
      "Convert a raw transcript (voice dictation or typed text) into a structured professional report. " +
      "Extracts objectives, achievements, challenges, next steps, meetings, blockers, activities, " +
      "and KPI metrics. Supports daily, weekly, monthly, quarterly, and annual report types.",
    inputSchema: {
      transcript: { type: "string", required: true, description: "Raw text or voice transcript to structure" },
      reportType: { type: "string", required: true, description: "'daily', 'weekly', 'monthly', 'quarterly', or 'annual'" },
      reportDate: { type: "string", required: false, description: "Report date (YYYY-MM-DD)" },
      kpiContext: { type: "array", required: false, description: "KPIs assigned to the employee for metric extraction" },
      templateSections: { type: "array", required: false, description: "Custom template sections to follow" },
      sectioned: { type: "boolean", required: false, description: "Whether transcript is pre-labeled with sections" },
    },
    outputDescription: "Structured report with title, objectives, achievements, challenges, next steps, KPI metrics",
  },
  {
    name: "appraise_performance",
    description:
      "Generate a comprehensive performance appraisal for an employee. " +
      "Combines deterministic metric computation (task completion, report quality, attendance, consistency) " +
      "with AI analysis for strengths, improvements, and recommendations. " +
      "Supports weekly, monthly, quarterly, and annual periods.",
    inputSchema: {
      employeeId: { type: "string", required: true, description: "The employee ID to appraise" },
      period: { type: "string", required: false, description: "'weekly', 'monthly', 'quarterly', 'annual' (default: monthly)" },
      weights: { type: "object", required: false, description: "Custom appraisal weights" },
      useAI: { type: "boolean", required: false, description: "Whether to use AI enhancement (default: true)" },
      persist: { type: "boolean", required: false, description: "Whether to save the appraisal (default: true)" },
    },
    outputDescription: "Performance appraisal with overall score, category breakdowns, strengths, improvements, trend analysis",
  },
];

// ─── Unified LLM Configuration ───

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

function getGroqKey(): string | undefined {
  return process.env.GROQ_API_KEY;
}

// ─── Shared LLM Call Helper ───

interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callLLM(
  messages: LLMMessage[],
  options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean },
): Promise<string | null> {
  const groqKey = getGroqKey();
  if (!groqKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const body: Record<string, unknown> = {
      model: GROQ_MODEL,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4000,
    };
    if (options?.jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error("LLM call failed:", res.status, await res.text().catch(() => ""));
      return null;
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    console.error("LLM call error:", error);
    return null;
  }
}

// ─── JSON Extraction Helper ───

export function extractJSON(text: string): Record<string, unknown> | null {
  if (!text) return null;

  const sanitized = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = sanitized.indexOf("{");
  const end = sanitized.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) return null;

  const jsonStr = sanitized.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

// ─── Capability Handlers ───

async function handleScreenCandidates(
  payload: Record<string, unknown>,
  tenantSlug: string,
): Promise<{ result: unknown; source: "ai" | "deterministic" | "heuristic" }> {
  const { runBatchAIScreening } = await import("@/lib/hr/db-recruitment");
  const result = await runBatchAIScreening(
    payload.requisitionId as string,
    tenantSlug,
    {
      selectionMode: payload.selectionMode as "percentage" | "fixed_number" | undefined,
      selectionValue: payload.selectionValue as number | undefined,
      minScoreThreshold: payload.minScoreThreshold as number | undefined,
    },
  );
  return { result, source: "deterministic" };
}

async function handleGenerateReport(
  payload: Record<string, unknown>,
  _tenantSlug: string,
  useAI: boolean,
): Promise<{ result: unknown; source: "ai" | "deterministic" | "heuristic" }> {
  const transcript = payload.transcript as string;
  const reportType = (payload.reportType as string) || "daily";
  const reportDate = (payload.reportDate as string) || new Date().toISOString().split("T")[0];
  const kpiContext = payload.kpiContext as any[];
  const templateSections = payload.templateSections as any[];
  const isSectioned = payload.sectioned === true;

  if (!transcript || transcript.trim().length < 10) {
    throw new Error("Transcript is too short. Please dictate or type at least a few sentences.");
  }

  if (!["daily", "weekly", "monthly", "quarterly", "annual"].includes(reportType)) {
    throw new Error("Valid report type is required (daily, weekly, monthly, quarterly, annual)");
  }

  // Build KPI context
  let kpiContextStr = "";
  if (kpiContext && kpiContext.length > 0) {
    kpiContextStr = "\n\nThe employee has the following KPIs assigned:\n";
    kpiContextStr += kpiContext
      .map((k: any, i: number) => `${i + 1}. ${k.title}${k.description ? ` — ${k.description}` : ""}${k.expected_outcome ? ` (Expected: ${k.expected_outcome})` : ""}`)
      .join("\n");
    kpiContextStr += "\n\nIf the employee mentions progress on any of these KPIs, extract the metrics and populate the kpiMetrics array.";
  }

  // Build template context
  let templateStr = "";
  if (templateSections && templateSections.length > 0) {
    templateStr = "\n\nThe report should follow this template structure:\n";
    templateStr += templateSections.map((s: any) => `- ${s.name || s.title}: ${s.prompt || s.description || ""}`).join("\n");
  }

  const sectionedInstructions = isSectioned
    ? `The transcript is already organized into labeled sections (e.g., [ACTIVITIES], [ACHIEVEMENTS], etc.). For each section:
- Refine the spoken/casual language into clear, professional business writing
- Fix grammar, remove filler words (um, uh, like, you know), and organize into logical sentences
- Use bullet points for lists of items
- Keep all meaningful content — don't drop details the employee mentioned
- CRITICAL: Map each labeled section to the corresponding JSON field. [ACTIVITIES] → activities, [ACHIEVEMENTS] → achievements, [OBJECTIVES] → objectives, [CHALLENGES] → challenges, [MEETINGS] → meetings, [BLOCKERS] → blockers, [NEXT STEPS] → next_steps, [ADDITIONAL NOTES] → additional_notes
- If a section has content, you MUST include that content in the corresponding JSON field — do NOT leave it empty
- If a section is truly empty or missing from the transcript, return an empty string for that field
- You may pull relevant content from one section into another if it clearly belongs there

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

Report date: ${reportDate}

TRANSCRIPT:
"""
${transcript}
"""

Return ONLY the JSON object:`;

  // Try AI first
  if (useAI) {
    const aiContent = await callLLM(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.3, maxTokens: 4000, jsonMode: true },
    );

    if (aiContent) {
      let parsed: any;
      try {
        parsed = JSON.parse(aiContent);
      } catch {
        const extracted = extractJSON(aiContent);
        if (extracted) {
          parsed = extracted;
        }
      }

      if (parsed) {
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
          kpiMetrics: Array.isArray(parsed.kpiMetrics)
            ? parsed.kpiMetrics
                .map((m: any) => ({
                  name: typeof m.name === "string" ? m.name : "",
                  target: typeof m.target === "string" ? m.target : "",
                  actual: typeof m.actual === "string" ? m.actual : "",
                  status: ["on_track", "ahead", "behind", "not_started"].includes(m.status) ? m.status : "not_started",
                }))
                .filter((m: any) => m.name)
            : [],
          raw_transcript: transcript,
        };
        return { result, source: "ai" };
      }
    }
  }

  // Fallback: heuristic chunking
  const { refineReportText } = await import("@/lib/ai/report-refiner");
  const draft = refineReportText(transcript, templateSections as any);
  return {
    result: {
      title: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report — ${reportDate}`,
      objectives: draft.objectives,
      achievements: draft.achievements,
      challenges: draft.challenges,
      next_steps: draft.nextSteps,
      meetings: draft.meetings,
      blockers: draft.blockers,
      activities: draft.activities,
      additional_notes: draft.additionalNotes,
      kpiMetrics: [],
      raw_transcript: transcript,
    },
    source: "heuristic",
  };
}

async function handleAppraisePerformance(
  payload: Record<string, unknown>,
  tenantSlug: string,
  useAI: boolean,
): Promise<{ result: unknown; source: "ai" | "deterministic" | "heuristic" }> {
  const { generateAppraisal } = await import("@/lib/ai/appraisal-engine");
  const { saveAppraisal, getAppraisalHistory, getAppraisalConfig, getDepartmentAppraisals, getPeerFeedbackForEmployee, getEmployeeGoals } = await import("@/lib/hr/db-appraisals");
  const { sql: SQL } = await import("@/lib/sql-client");
  const { ensureHrTables } = await import("@/lib/hr/db");

  const employeeId = payload.employeeId as string;
  const period = (payload.period as string) || "monthly";
  const persist = payload.persist !== false;

  if (!employeeId) throw new Error("employeeId is required");

  await ensureHrTables(SQL);

  // Fetch employee
  const empRows = await SQL`
    SELECT id, name, email, job_title, role, department_id, hire_date
    FROM admin_employees
    WHERE id = ${employeeId} AND tenant_slug = ${tenantSlug}
    LIMIT 1
  `;
  const employee = (empRows as any[])[0];
  if (!employee) throw new Error("Employee not found");

  // Determine period range
  const periodStart = new Date();
  if (period === "weekly") periodStart.setDate(periodStart.getDate() - 7);
  else if (period === "monthly") periodStart.setMonth(periodStart.getMonth() - 1);
  else if (period === "quarterly") periodStart.setMonth(periodStart.getMonth() - 3);
  else if (period === "annual") periodStart.setFullYear(periodStart.getFullYear() - 1);
  const periodEnd = new Date().toISOString();

  // Fetch data
  let tasks: any[] = [];
  try {
    tasks = await SQL`
      SELECT id, title, description, expected_outcome, weight, is_kpi, frequency, due_date, status, completion_note
      FROM admin_staff_tasks
      WHERE tenant_slug = ${tenantSlug} AND employee_id = ${employeeId}
        AND created_at >= ${periodStart.toISOString()}
      ORDER BY created_at DESC LIMIT 200
    `;
  } catch {
    tasks = await SQL`
      SELECT id, title, description, frequency, due_date, status
      FROM admin_staff_tasks
      WHERE tenant_slug = ${tenantSlug} AND employee_id = ${employeeId}
      ORDER BY created_at DESC LIMIT 200
    `;
  }

  let reports: any[] = [];
  try {
    reports = await SQL`
      SELECT id, title, report_type, report_date, objectives, achievements, challenges,
             next_steps, meetings, blockers, activities, additional_notes, refined_text,
             status, submitted_at, appraisal
      FROM admin_staff_reports
      WHERE tenant_slug = ${tenantSlug} AND employee_id = ${employeeId}
        AND submitted_at >= ${periodStart.toISOString()}
      ORDER BY submitted_at DESC LIMIT 100
    `;
  } catch {
    reports = await SQL`
      SELECT id, title, report_type, report_date, objectives, achievements, status, submitted_at
      FROM admin_staff_reports
      WHERE tenant_slug = ${tenantSlug} AND employee_id = ${employeeId}
      ORDER BY submitted_at DESC LIMIT 100
    `;
  }

  let attendance: any[] = [];
  try {
    attendance = await SQL`
      SELECT status, check_in, check_out, date
      FROM admin_attendance
      WHERE tenant_slug = ${tenantSlug} AND employee_id = ${employeeId}
        AND date >= ${periodStart.toISOString().split("T")[0]}
      ORDER BY date DESC LIMIT 90
    `;
  } catch {}

  let peerFeedback: any[] = [];
  try { peerFeedback = await getPeerFeedbackForEmployee(tenantSlug, employeeId); } catch {}

  let goals: any[] = [];
  try { goals = await getEmployeeGoals(tenantSlug, employeeId); } catch {}

  const previousAppraisals = await getAppraisalHistory(tenantSlug, employeeId, 5);

  let departmentAppraisals: any[] = [];
  if (employee.department_id) {
    try { departmentAppraisals = await getDepartmentAppraisals(tenantSlug, employee.department_id, 50); } catch {}
  }

  let config: any = null;
  try { config = await getAppraisalConfig(tenantSlug); } catch {}

  const mergedWeights = { ...(config?.weights || {}), ...(payload.weights || {}) };
  const shouldUseAI = useAI && (config?.useAI ?? true);
  const groqKey = shouldUseAI ? getGroqKey() : undefined;

  const result = await generateAppraisal(
    {
      employee,
      tasks,
      reports,
      attendance,
      previousAppraisals,
      departmentAppraisals: departmentAppraisals.filter((a: any) => a.employeeId !== employeeId),
      peerFeedback,
      goals,
      weights: mergedWeights,
      period: period as any,
      periodStart: periodStart.toISOString(),
      periodEnd,
      useAI: shouldUseAI,
    },
    groqKey,
  );
  result.tenantSlug = tenantSlug;

  let appraisalId: string | undefined;
  if (persist) {
    try { appraisalId = await saveAppraisal(tenantSlug, result, "AI Agent"); result.id = appraisalId; } catch {}
  }

  return {
    result: { ...result, appraisalId },
    source: result.generatedBy === "ai" ? "ai" : "deterministic",
  };
}

// ─── Main Agent Entry Point ───

export async function runAgent(request: AgentRequest): Promise<AgentResponse> {
  const startTime = Date.now();
  const useAI = request.useAI !== false;

  try {
    let handlerResult: { result: unknown; source: "ai" | "deterministic" | "heuristic" };

    switch (request.capability) {
      case "screen_candidates":
        handlerResult = await handleScreenCandidates(request.payload, request.tenantSlug);
        break;
      case "generate_report":
        handlerResult = await handleGenerateReport(request.payload, request.tenantSlug, useAI);
        break;
      case "appraise_performance":
        handlerResult = await handleAppraisePerformance(request.payload, request.tenantSlug, useAI);
        break;
      default:
        throw new Error(`Unknown capability: ${request.capability}`);
    }

    return {
      success: true,
      capability: request.capability,
      result: handlerResult.result,
      metadata: {
        source: handlerResult.source,
        model: handlerResult.source === "ai" ? GROQ_MODEL : null,
        generatedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      },
    };
  } catch (error) {
    return {
      success: false,
      capability: request.capability,
      result: null,
      metadata: {
        source: "deterministic",
        model: null,
        generatedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      },
      error: error instanceof Error ? error.message : "Agent execution failed",
    };
  }
}
