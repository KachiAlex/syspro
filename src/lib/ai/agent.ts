/**
 * Unified AI Agent Core
 *
 * Single entry point for all AI capabilities in the system.
 * Routes requests to specialized handlers based on capability.
 * Uses Groq (llama-3.3-70b-versatile) as the unified LLM provider.
 * Falls back to deterministic methods when AI is unavailable.
 *
 * Capabilities:
 *  - screen_candidates     : Talent acquisition — score & rank job applicants
 *  - generate_report       : Report generation — convert transcripts to structured reports
 *  - appraise_performance  : Productivity appraisal — evaluate employee performance
 *  - summarize             : General-purpose summarizer across entities (dept, leads, requisitions, reports)
 *  - generate_training_plan: Personalized training plan from appraisal improvement areas
 *  - proactive_insights    : Detect anomalies and flag actionable patterns across the tenant
 *
 * External systems can call the agent via /api/ai/agent with an API key,
 * or connect via MCP at /api/ai/agent/mcp.
 */

// ─── Types ───

export type AgentCapability =
  | "screen_candidates"
  | "generate_report"
  | "appraise_performance"
  | "summarize"
  | "generate_training_plan"
  | "proactive_insights";

export interface AgentRequest {
  capability: AgentCapability;
  payload: Record<string, unknown>;
  tenantSlug: string;
  useAI?: boolean;
  conversationId?: string;
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
    conversationId?: string;
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
  {
    name: "summarize",
    description:
      "Generate an AI summary across a scope of data. Supports summarizing departments, " +
      "CRM pipelines (leads, deals, customers), procurement requisitions, or employee reports. " +
      "The agent fetches the relevant data and produces a concise narrative summary with key metrics, " +
      "trends, and action items.",
    inputSchema: {
      scope: { type: "string", required: true, description: "What to summarize: 'department', 'crm_pipeline', 'procurement', 'reports', or 'employee'" },
      departmentId: { type: "string", required: false, description: "Department ID (for 'department' scope)" },
      employeeId: { type: "string", required: false, description: "Employee ID (for 'employee' or 'reports' scope)" },
      period: { type: "string", required: false, description: "Time period: 'weekly', 'monthly', 'quarterly', 'annual' (default: monthly)" },
      focus: { type: "string", required: false, description: "Optional focus area, e.g. 'conversion rates', 'budget overruns', 'reporting compliance'" },
    },
    outputDescription: "Narrative summary with key metrics, trends, highlights, concerns, and recommended actions",
  },
  {
    name: "generate_training_plan",
    description:
      "Generate a personalized training and development plan for an employee based on their latest " +
      "appraisal results. Identifies skill gaps from improvement areas and recommends specific " +
      "training modules, timelines, and success metrics.",
    inputSchema: {
      employeeId: { type: "string", required: true, description: "The employee ID to generate a training plan for" },
      appraisalId: { type: "string", required: false, description: "Specific appraisal ID to use (defaults to latest)" },
      focusAreas: { type: "array", required: false, description: "Override focus areas (defaults to appraisal improvement areas)" },
      timelineWeeks: { type: "number", required: false, description: "Plan duration in weeks (default: 12)" },
    },
    outputDescription: "Structured training plan with modules, timelines, success metrics, and progress checkpoints",
  },
  {
    name: "proactive_insights",
    description:
      "Scan the tenant for actionable patterns and anomalies. Detects: score drops in appraisals, " +
      "missing reports, top candidates ready for interview, stale CRM leads, procurement budget overruns, " +
      "and attendance anomalies. Returns prioritized insights with severity and recommended actions.",
    inputSchema: {
      categories: { type: "array", required: false, description: "Filter to specific categories: 'appraisals', 'reports', 'recruitment', 'crm', 'procurement', 'attendance'" },
      minSeverity: { type: "string", required: false, description: "Minimum severity: 'low', 'medium', 'high' (default: low)" },
    },
    outputDescription: "Prioritized list of insights with category, severity, description, affected entities, and recommended actions",
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

// ─── Summarize Handler ───

async function handleSummarize(
  payload: Record<string, unknown>,
  tenantSlug: string,
  useAI: boolean,
): Promise<{ result: unknown; source: "ai" | "deterministic" | "heuristic" }> {
  const scope = payload.scope as string;
  const departmentId = payload.departmentId as string;
  const employeeId = payload.employeeId as string;
  const period = (payload.period as string) || "monthly";
  const focus = (payload.focus as string) || "";

  const { sql: SQL } = await import("@/lib/sql-client");
  const { ensureHrTables } = await import("@/lib/hr/db");

  const periodStart = new Date();
  if (period === "weekly") periodStart.setDate(periodStart.getDate() - 7);
  else if (period === "monthly") periodStart.setMonth(periodStart.getMonth() - 1);
  else if (period === "quarterly") periodStart.setMonth(periodStart.getMonth() - 3);
  else if (period === "annual") periodStart.setFullYear(periodStart.getFullYear() - 1);

  let contextData: Record<string, unknown> = {};
  let contextDescription = "";

  switch (scope) {
    case "department": {
      await ensureHrTables(SQL);
      const deptFilter = departmentId ? SQL`and department_id = ${departmentId}` : SQL``;
      const employees = await SQL`
        select id, name, email, job_title, role, department_id
        from admin_employees
        where tenant_slug = ${tenantSlug} and status = 'active'
        ${deptFilter as any}
        order by name
      `;
      const empIds = (employees as any[]).map((e) => e.id);

      let appraisals: any[] = [];
      if (empIds.length > 0) {
        try {
          appraisals = await SQL`
            select * from admin_appraisals
            where tenant_slug = ${tenantSlug}
              and employee_id = any(${empIds as any})
              and generated_at >= ${periodStart.toISOString()}
            order by generated_at desc limit 50
          `;
        } catch {}
      }

      let reports: any[] = [];
      if (empIds.length > 0) {
        try {
          reports = await SQL`
            select id, employee_id, title, report_type, status, submitted_at
            from admin_staff_reports
            where tenant_slug = ${tenantSlug}
              and employee_id = any(${empIds as any})
              and submitted_at >= ${periodStart.toISOString()}
            order by submitted_at desc limit 100
          `;
        } catch {}
      }

      contextData = { employees, appraisals, reports };
      contextDescription = `Department summary for ${empIds.length} employees over the past ${period}`;
      break;
    }

    case "crm_pipeline": {
      const { listLeads, listDeals, listCustomers } = await import("@/lib/crm/db");
      const [leads, deals, customers] = await Promise.all([
        listLeads({ tenantSlug, limit: 100 }),
        listDeals({ tenantSlug, limit: 100 }),
        listCustomers({ tenantSlug, limit: 100 }),
      ]);
      contextData = { leads, deals, customers };
      contextDescription = `CRM pipeline summary: ${leads.length} leads, ${deals.length} deals, ${customers.length} customers`;
      break;
    }

    case "procurement": {
      try {
        const requisitions = await SQL`
          select * from procurement_requisitions
          where tenant_slug = ${tenantSlug}
          order by created_at desc limit 50
        `;
        const purchaseOrders = await SQL`
          select * from procurement_purchase_orders
          where tenant_slug = ${tenantSlug}
          order by created_at desc limit 50
        `.catch(() => [] as any[]);
        contextData = { requisitions, purchaseOrders };
        contextDescription = `Procurement summary: ${(requisitions as any[]).length} requisitions, ${(purchaseOrders as any[]).length} purchase orders`;
      } catch {
        contextData = { requisitions: [], note: "Procurement tables not yet initialized" };
        contextDescription = "Procurement summary (no data available)";
      }
      break;
    }

    case "reports": {
      await ensureHrTables(SQL);
      const empFilter = employeeId ? SQL`and employee_id = ${employeeId}` : SQL``;
      const reports = await SQL`
        select id, employee_id, title, report_type, report_date, objectives, achievements,
               challenges, next_steps, activities, status, submitted_at
        from admin_staff_reports
        where tenant_slug = ${tenantSlug}
          and submitted_at >= ${periodStart.toISOString()}
          ${empFilter as any}
        order by submitted_at desc limit 100
      `;
      contextData = { reports };
      contextDescription = `Reports summary: ${(reports as any[]).length} reports over the past ${period}`;
      break;
    }

    case "employee": {
      if (!employeeId) throw new Error("employeeId is required for 'employee' scope");
      await ensureHrTables(SQL);
      const empRows = await SQL`
        select id, name, email, job_title, role, department_id, hire_date
        from admin_employees where id = ${employeeId} and tenant_slug = ${tenantSlug} limit 1
      `;
      const employee = (empRows as any[])[0];
      if (!employee) throw new Error("Employee not found");

      const tasks = await SQL`
        select id, title, status, is_kpi, due_date from admin_staff_tasks
        where tenant_slug = ${tenantSlug} and employee_id = ${employeeId}
        order by created_at desc limit 50
      `.catch(() => [] as any[]);

      const reports = await SQL`
        select id, title, report_type, status, submitted_at from admin_staff_reports
        where tenant_slug = ${tenantSlug} and employee_id = ${employeeId}
        order by submitted_at desc limit 20
      `.catch(() => [] as any[]);

      const appraisals = await SQL`
        select * from admin_appraisals
        where tenant_slug = ${tenantSlug} and employee_id = ${employeeId}
        order by generated_at desc limit 5
      `.catch(() => [] as any[]);

      contextData = { employee, tasks, reports, appraisals };
      contextDescription = `Employee summary for ${employee.name}`;
      break;
    }

    default:
      throw new Error(`Unknown summarize scope: ${scope}. Use 'department', 'crm_pipeline', 'procurement', 'reports', or 'employee'`);
  }

  const systemPrompt = `You are an expert business analyst AI assistant. Your job is to analyze data and produce a concise, actionable summary.

Focus on: ${focus || "overall performance and key patterns"}

Return ONLY a valid JSON object with this structure:
{
  "headline": "One-sentence executive summary",
  "keyMetrics": [{"label": "string", "value": "string"}],
  "highlights": ["string", ...],
  "concerns": ["string", ...],
  "trends": ["string", ...],
  "recommendedActions": [{"action": "string", "priority": "high|medium|low", "owner": "string"}]
}

Rules:
- Be specific — reference actual numbers, names, and dates from the data
- Keep highlights and concerns to 3-5 items each
- Recommended actions should be concrete and assignable
- Do NOT include commentary outside the JSON`;

  const userPrompt = `Summarize the following data.

Context: ${contextDescription}
Period: ${period}
Tenant: ${tenantSlug}

Data:
${JSON.stringify(contextData, null, 2).slice(0, 12000)}

Return ONLY the JSON object:`;

  if (useAI) {
    const aiContent = await callLLM(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.3, maxTokens: 2000, jsonMode: true },
    );

    if (aiContent) {
      const parsed = extractJSON(aiContent);
      if (parsed) {
        return { result: parsed, source: "ai" };
      }
    }
  }

  return {
    result: {
      headline: contextDescription,
      keyMetrics: [],
      highlights: [],
      concerns: [],
      trends: [],
      recommendedActions: [],
      note: "AI summarization unavailable. Raw data provided.",
      rawData: JSON.stringify(contextData, null, 2).slice(0, 4000),
    },
    source: "deterministic",
  };
}

// ─── Generate Training Plan Handler ───

async function handleGenerateTrainingPlan(
  payload: Record<string, unknown>,
  tenantSlug: string,
  useAI: boolean,
): Promise<{ result: unknown; source: "ai" | "deterministic" | "heuristic" }> {
  const employeeId = payload.employeeId as string;
  const appraisalId = payload.appraisalId as string;
  const focusAreas = (payload.focusAreas as string[]) || null;
  const timelineWeeks = (payload.timelineWeeks as number) || 12;

  if (!employeeId) throw new Error("employeeId is required");

  const { sql: SQL } = await import("@/lib/sql-client");
  const { ensureHrTables } = await import("@/lib/hr/db");
  await ensureHrTables(SQL);

  const empRows = await SQL`
    select id, name, email, job_title, role, department_id, hire_date
    from admin_employees where id = ${employeeId} and tenant_slug = ${tenantSlug} limit 1
  `;
  const employee = (empRows as any[])[0];
  if (!employee) throw new Error("Employee not found");

  const appraisalRows = appraisalId
    ? await SQL`select * from admin_appraisals where id = ${appraisalId} and tenant_slug = ${tenantSlug} limit 1`
    : await SQL`select * from admin_appraisals where tenant_slug = ${tenantSlug} and employee_id = ${employeeId} order by generated_at desc limit 1`;
  const appraisal = (appraisalRows as any[])[0];

  if (!appraisal) {
    throw new Error("No appraisal found for this employee. Run an appraisal first.");
  }

  let appraisalData: any = appraisal;
  try {
    if (typeof appraisal === "string") appraisalData = JSON.parse(appraisal);
    else if (appraisal.result && typeof appraisal.result === "string") appraisalData = JSON.parse(appraisal.result);
    else appraisalData = appraisal;
  } catch {
    appraisalData = appraisal;
  }

  const improvements = focusAreas || appraisalData.improvements || appraisalData.areas_for_improvement || [];
  const strengths = appraisalData.strengths || [];
  const overallScore = appraisalData.overall_score || appraisalData.overallScore || "N/A";
  const rating = appraisalData.rating || "N/A";

  const systemPrompt = `You are an expert talent development consultant. Create a personalized training and development plan based on an employee's performance appraisal.

Return ONLY a valid JSON object with this structure:
{
  "employeeName": "string",
  "summary": "Brief overview of the plan rationale",
  "focusAreas": ["string", ...],
  "modules": [
    {
      "title": "string",
      "description": "string",
      "skills": ["string", ...],
      "format": "online_course|workshop|mentorship|reading|project",
      "durationWeeks": number,
      "startWeek": number,
      "successMetrics": ["string", ...],
      "resources": ["string", ...]
    }
  ],
  "checkpoints": [
    {
      "week": number,
      "milestone": "string",
      "evaluationMethod": "string"
    }
  ],
  "expectedOutcome": "string"
}

Rules:
- Create 3-5 focused training modules addressing the improvement areas
- Sequence modules logically (foundational skills first)
- Each module should have clear, measurable success metrics
- Include progress checkpoints at regular intervals
- Be specific about recommended resources (course types, books, etc.)
- Tailor to the employee's role and seniority`;

  const userPrompt = `Create a ${timelineWeeks}-week training plan for the following employee.

Employee:
${JSON.stringify(employee, null, 2)}

Latest Appraisal (score: ${overallScore}, rating: ${rating}):
Strengths: ${JSON.stringify(strengths)}
Improvement areas: ${JSON.stringify(improvements)}
Full appraisal data:
${JSON.stringify(appraisalData, null, 2).slice(0, 6000)}

Return ONLY the JSON object:`;

  if (useAI) {
    const aiContent = await callLLM(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.4, maxTokens: 3000, jsonMode: true },
    );

    if (aiContent) {
      const parsed = extractJSON(aiContent);
      if (parsed) {
        return { result: parsed, source: "ai" };
      }
    }
  }

  const areas = improvements.length > 0 ? improvements : ["General skill development"];
  return {
    result: {
      employeeName: employee.name,
      summary: `Training plan addressing: ${areas.join(", ")}`,
      focusAreas: areas,
      modules: areas.map((area: string, i: number) => ({
        title: `Training Module ${i + 1}: ${area}`,
        description: `Focused development in ${area}`,
        skills: [area],
        format: "online_course",
        durationWeeks: Math.ceil(timelineWeeks / areas.length),
        startWeek: i * Math.ceil(timelineWeeks / areas.length) + 1,
        successMetrics: [`Demonstrate improvement in ${area}`],
        resources: ["To be determined by HR"],
      })),
      checkpoints: [
        { week: Math.floor(timelineWeeks / 2), milestone: "Mid-point review", evaluationMethod: "Manager check-in" },
        { week: timelineWeeks, milestone: "Final evaluation", evaluationMethod: "Performance reassessment" },
      ],
      expectedOutcome: `Measurable improvement in identified areas over ${timelineWeeks} weeks`,
    },
    source: "deterministic",
  };
}

// ─── Proactive Insights Handler ───

async function handleProactiveInsights(
  payload: Record<string, unknown>,
  tenantSlug: string,
): Promise<{ result: unknown; source: "ai" | "deterministic" | "heuristic" }> {
  const categories = (payload.categories as string[]) || null;
  const minSeverity = (payload.minSeverity as string) || "low";

  const { sql: SQL } = await import("@/lib/sql-client");
  const { ensureHrTables } = await import("@/lib/hr/db");
  await ensureHrTables(SQL);

  const insights: Array<{
    category: string;
    severity: "high" | "medium" | "low";
    title: string;
    description: string;
    affectedEntities: string[];
    recommendedAction: string;
  }> = [];

  const severityOrder: Record<string, number> = { low: 0, medium: 1, high: 2 };
  const minSeverityLevel = severityOrder[minSeverity] ?? 0;

  const shouldCheck = (cat: string) => !categories || categories.includes(cat);

  // 1. Appraisal score drops
  if (shouldCheck("appraisals")) {
    try {
      const recentAppraisals = await SQL`
        select employee_id, overall_score, generated_at,
               lag(overall_score) over (partition by employee_id order by generated_at) as prev_score
        from admin_appraisals
        where tenant_slug = ${tenantSlug}
          and generated_at >= ${new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()}
        order by generated_at desc
        limit 100
      `;
      for (const a of recentAppraisals as any[]) {
        if (a.prev_score != null && a.overall_score < a.prev_score - 10) {
          insights.push({
            category: "appraisals",
            severity: "high",
            title: `Performance score dropped for employee ${a.employee_id}`,
            description: `Score dropped from ${a.prev_score} to ${a.overall_score} (${a.prev_score - a.overall_score} point drop)`,
            affectedEntities: [a.employee_id],
            recommendedAction: "Schedule a check-in to understand the root cause and provide support",
          });
        }
      }
    } catch {}
  }

  // 2. Missing reports (employees who haven't reported in 5+ days)
  if (shouldCheck("reports")) {
    try {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const employees = await SQL`
        select e.id, e.name, e.email, e.department_id
        from admin_employees e
        where e.tenant_slug = ${tenantSlug} and e.status = 'active'
      `;
      const recentReporters = await SQL`
        select distinct employee_id from admin_staff_reports
        where tenant_slug = ${tenantSlug} and submitted_at >= ${fiveDaysAgo}
      `;
      const reporterIds = new Set((recentReporters as any[]).map((r) => r.employee_id));
      const missingReporters = (employees as any[]).filter((e) => !reporterIds.has(e.id));
      if (missingReporters.length > 0) {
        insights.push({
          category: "reports",
          severity: "medium",
          title: `${missingReporters.length} employee(s) haven't submitted a report in 5+ days`,
          description: `Missing reports from: ${missingReporters.slice(0, 5).map((e) => e.name || e.id).join(", ")}${missingReporters.length > 5 ? ` and ${missingReporters.length - 5} more` : ""}`,
          affectedEntities: missingReporters.map((e) => e.id),
          recommendedAction: "Send reminders and check if any blockers are preventing report submission",
        });
      }
    } catch {}
  }

  // 3. Top candidates ready for interview
  if (shouldCheck("recruitment")) {
    try {
      const topCandidates = await SQL`
        select a.id as application_id, a.requisition_id, a.ai_score, c.full_name,
               r.job_title
        from admin_applications a
        join admin_candidates c on c.id = a.candidate_id
        left join admin_job_requisitions r on r.id = a.requisition_id
        where a.tenant_slug = ${tenantSlug}
          and a.ai_score >= 85
          and a.status in ('applied', 'under_review', 'screened')
        order by a.ai_score desc
        limit 10
      `;
      if ((topCandidates as any[]).length > 0) {
        insights.push({
          category: "recruitment",
          severity: "medium",
          title: `${(topCandidates as any[]).length} high-scoring candidates ready for interview`,
          description: `Top candidates: ${(topCandidates as any[]).slice(0, 3).map((c: any) => `${c.full_name} (${c.ai_score})`).join(", ")}`,
          affectedEntities: (topCandidates as any[]).map((c: any) => c.application_id),
          recommendedAction: "Move top candidates to interview stage before they accept other offers",
        });
      }
    } catch {}
  }

  // 4. Stale CRM leads (no activity in 14+ days)
  if (shouldCheck("crm")) {
    try {
      const staleLeads = await SQL`
        select id, company_name, contact_name, stage, created_at, updated_at
        from crm_leads
        where tenant_slug = ${tenantSlug}
          and stage < 4
          and updated_at < ${new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()}
        order by updated_at asc
        limit 20
      `;
      if ((staleLeads as any[]).length > 0) {
        insights.push({
          category: "crm",
          severity: "low",
          title: `${(staleLeads as any[]).length} CRM leads haven't been updated in 14+ days`,
          description: `Stale leads: ${(staleLeads as any[]).slice(0, 3).map((l: any) => l.company_name || l.contact_name || l.id).join(", ")}`,
          affectedEntities: (staleLeads as any[]).map((l: any) => l.id),
          recommendedAction: "Re-engage stale leads or move them to a nurture sequence",
        });
      }
    } catch {}
  }

  // 5. Procurement budget overruns
  if (shouldCheck("procurement")) {
    try {
      const expensiveReqs = await SQL`
        select id, notes, created_at,
               (select sum(quantity * unit_cost) from procurement_requisition_items where requisition_id = r.id) as total_value
        from procurement_requisitions r
        where tenant_slug = ${tenantSlug}
          and status in ('pending', 'approved')
        order by total_value desc
        limit 10
      `;
      const highValue = (expensiveReqs as any[]).filter((r) => r.total_value && r.total_value > 100000);
      if (highValue.length > 0) {
        insights.push({
          category: "procurement",
          severity: "medium",
          title: `${highValue.length} high-value procurement requisitions pending`,
          description: `Highest value: ${highValue[0].total_value} (ID: ${highValue[0].id})`,
          affectedEntities: highValue.map((r) => r.id),
          recommendedAction: "Review high-value requisitions for budget alignment and approval urgency",
        });
      }
    } catch {}
  }

  // 6. Attendance anomalies
  if (shouldCheck("attendance")) {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const attendanceStats = await SQL`
        select employee_id,
               count(*) filter (where status = 'absent') as absent_days,
               count(*) filter (where status = 'late') as late_days,
               count(*) as total_days
        from admin_attendance
        where tenant_slug = ${tenantSlug}
          and date >= ${thirtyDaysAgo}
        group by employee_id
        having count(*) filter (where status = 'absent') >= 3
        order by absent_days desc
        limit 10
      `;
      for (const a of attendanceStats as any[]) {
        insights.push({
          category: "attendance",
          severity: a.absent_days >= 5 ? "high" : "medium",
          title: `Employee ${a.employee_id} has ${a.absent_days} absences in the last 30 days`,
          description: `${a.absent_days} absent days, ${a.late_days} late days out of ${a.total_days} recorded days`,
          affectedEntities: [a.employee_id],
          recommendedAction: "Investigate cause and discuss with the employee; consider formal review if pattern continues",
        });
      }
    } catch {}
  }

  // Filter by min severity
  const filtered = insights.filter((i) => severityOrder[i.severity] >= minSeverityLevel);

  return {
    result: {
      totalInsights: filtered.length,
      insights: filtered,
      generatedAt: new Date().toISOString(),
      tenantSlug,
    },
    source: "deterministic",
  };
}

// ─── Conversation Memory ───

export interface ConversationTurn {
  capability: AgentCapability;
  payloadSummary: string;
  resultSummary: string;
  timestamp: string;
}

const conversationStore = new Map<string, { turns: ConversationTurn[]; tenantSlug: string }>();
const MAX_TURNS_PER_CONVERSATION = 10;
const CONVERSATION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getConversation(id: string, tenantSlug: string): { turns: ConversationTurn[]; tenantSlug: string } {
  let conv = conversationStore.get(id);
  if (!conv) {
    conv = { turns: [], tenantSlug };
    conversationStore.set(id, conv);
  }
  return conv;
}

function addTurn(id: string, tenantSlug: string, turn: ConversationTurn) {
  const conv = getConversation(id, tenantSlug);
  conv.turns.push(turn);
  if (conv.turns.length > MAX_TURNS_PER_CONVERSATION) {
    conv.turns.shift();
  }
}

function summarizePayload(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload).slice(0, 5);
  return keys.map((k) => `${k}=${typeof payload[k] === "string" ? (payload[k] as string).slice(0, 50) : JSON.stringify(payload[k]).slice(0, 50)}`).join(", ");
}

function summarizeResult(result: unknown): string {
  if (!result) return "empty";
  const str = JSON.stringify(result);
  return str.slice(0, 200);
}

export function buildConversationContext(id: string): string {
  const conv = conversationStore.get(id);
  if (!conv || conv.turns.length === 0) return "";
  const lines = conv.turns.map((t, i) =>
    `Turn ${i + 1} [${t.capability}]: ${t.payloadSummary} → ${t.resultSummary}`,
  );
  return `\n\nPrevious conversation context:\n${lines.join("\n")}\n`;
}

export function getConversationHistory(id: string): ConversationTurn[] {
  return conversationStore.get(id)?.turns ?? [];
}

// Clean up expired conversations periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, conv] of conversationStore.entries()) {
    const lastTurn = conv.turns[conv.turns.length - 1];
    if (lastTurn && now - new Date(lastTurn.timestamp).getTime() > CONVERSATION_TTL_MS) {
      conversationStore.delete(id);
    }
  }
}, 5 * 60 * 1000);

// ─── Main Agent Entry Point ───

export async function runAgent(request: AgentRequest): Promise<AgentResponse> {
  const startTime = Date.now();
  const useAI = request.useAI !== false;

  // Quota check (non-blocking — failures won't stop execution)
  try {
    const { checkQuota } = await import("@/lib/ai/usage-log");
    const quota = await checkQuota(request.tenantSlug);
    if (quota.exceeded) {
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
        error: `AI agent quota exceeded. Daily: ${quota.dailyUsed}/${quota.dailyLimit}, Monthly: ${quota.monthlyUsed}/${quota.monthlyLimit}. Please try again later or contact support.`,
      };
    }
  } catch {
    // Quota check failure should not block agent execution
  }

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
      case "summarize":
        handlerResult = await handleSummarize(request.payload, request.tenantSlug, useAI);
        break;
      case "generate_training_plan":
        handlerResult = await handleGenerateTrainingPlan(request.payload, request.tenantSlug, useAI);
        break;
      case "proactive_insights":
        handlerResult = await handleProactiveInsights(request.payload, request.tenantSlug);
        break;
      default:
        throw new Error(`Unknown capability: ${request.capability}`);
    }

    // Store conversation turn if conversationId provided
    if (request.conversationId) {
      addTurn(request.conversationId, request.tenantSlug, {
        capability: request.capability,
        payloadSummary: summarizePayload(request.payload),
        resultSummary: summarizeResult(handlerResult.result),
        timestamp: new Date().toISOString(),
      });
    }

    const durationMs = Date.now() - startTime;

    // Log usage (fire-and-forget, non-blocking)
    import("@/lib/ai/usage-log").then(({ logAgentCall }) =>
      logAgentCall({
        tenantSlug: request.tenantSlug,
        capability: request.capability,
        source: handlerResult.source,
        success: true,
        durationMs,
        model: handlerResult.source === "ai" ? GROQ_MODEL : null,
        conversationId: request.conversationId,
      }),
    ).catch(() => {});

    return {
      success: true,
      capability: request.capability,
      result: handlerResult.result,
      metadata: {
        source: handlerResult.source,
        model: handlerResult.source === "ai" ? GROQ_MODEL : null,
        generatedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        ...(request.conversationId ? { conversationId: request.conversationId } : {}),
      },
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Agent execution failed";
    const durationMs = Date.now() - startTime;

    // Log failed usage (fire-and-forget)
    import("@/lib/ai/usage-log").then(({ logAgentCall }) =>
      logAgentCall({
        tenantSlug: request.tenantSlug,
        capability: request.capability,
        source: "deterministic",
        success: false,
        durationMs,
        model: null,
        conversationId: request.conversationId,
        errorMessage: errMsg,
      }),
    ).catch(() => {});

    return {
      success: false,
      capability: request.capability,
      result: null,
      metadata: {
        source: "deterministic",
        model: null,
        generatedAt: new Date().toISOString(),
        durationMs,
      },
      error: errMsg,
    };
  }
}
