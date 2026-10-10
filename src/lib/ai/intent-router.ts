/**
 * Intent router — maps free-text user messages to an agent capability + payload.
 *
 * LLM path uses the shared Groq callLLM in json mode; a keyword-based
 * deterministic fallback covers outages and keeps the router usable without
 * an API key. When the caller already chose a capability (`hint`), only the
 * payload extraction runs.
 */

import { callLLM, extractJSON, GROQ_MODEL_FAST, type AgentCapability } from "./agent";

export interface RoutedIntent {
  capability: AgentCapability | null;
  payload: Record<string, unknown>;
  rationale?: string;
}

const CAPABILITIES: AgentCapability[] = [
  "screen_candidates",
  "generate_report",
  "appraise_performance",
  "summarize",
  "generate_training_plan",
  "proactive_insights",
  "propose_action",
  "query_data",
];

function normalizeCapability(value: unknown): AgentCapability | null {
  const v = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (CAPABILITIES as string[]).includes(v) ? (v as AgentCapability) : null;
}

// ─── Keyword fallback ───

function extractId(msg: string): string | null {
  const m = msg.match(/(?:req|requisition|emp|employee|candidate|id)[\s#:-]*([a-z0-9_-]{3,})/i)
    || msg.match(/\b([a-z0-9]+-[a-z0-9-]{3,})\b/i);
  return m ? m[1] : null;
}

function fallbackRoute(message: string, hint: AgentCapability | null): RoutedIntent {
  const msg = message.toLowerCase();

  let capability = hint;
  if (!capability) {
    if (/\b(create|assign|add|new)\b.*\b(task|to-?do)\b|\b(post|send|publish|broadcast|make)\b.*\b(announcement|announce|notice)\b/.test(msg)) {
      capability = "propose_action";
    } else if (/\b(screen|shortlist|rank|score)\w*\b.*\b(candidate|applicant|application)/.test(msg) || /\b(candidate|applicant)s?\b.*\b(screen|shortlist|rank|score)/.test(msg)) {
      capability = "screen_candidates";
    } else if (/\b(apprais\w*|performance review|evaluat\w*)/.test(msg)) {
      capability = "appraise_performance";
    } else if (/\b(training plan|learning plan|upskill\w*)/.test(msg)) {
      capability = "generate_training_plan";
    } else if (/\b(draft|write|generate|refine)\w*\b.*\b(report|update)\b/.test(msg) || msg.split(" ").length > 40) {
      capability = "generate_report";
    } else if (
      /\bhow (many|much)\b|\bwho('s| is| are)?\b.*\b(leave|absent|report|overdue)\b|\b(headcount|compliance|outstanding|receivable|pipeline value|leaderboard|top candidates)\b/.test(msg)
    ) {
      capability = "query_data";
    } else if (/\b(summar\w*|overview|status of|how is|how are|how's)/.test(msg)) {
      capability = "summarize";
    } else if (/\b(insight\w*|anomal\w*|issue\w*|risk\w*|problem\w*|attention|alert\w*|flag\w*)/.test(msg)) {
      capability = "proactive_insights";
    }
  }

  const id = extractId(message);
  switch (capability) {
    case "screen_candidates":
      return { capability, payload: { requisitionId: id || message } };
    case "appraise_performance":
      return {
        capability,
        payload: {
          employeeId: id || message,
          period: msg.includes("week") ? "weekly" : msg.includes("quarter") ? "quarterly" : msg.includes("annual") ? "annual" : "monthly",
        },
      };
    case "generate_training_plan":
      return {
        capability,
        payload: {
          employeeId: id || message,
          timelineWeeks: Number(msg.match(/(\d+)\s*week/)?.[1]) || 12,
        },
      };
    case "generate_report":
      return {
        capability,
        payload: {
          transcript: message,
          reportType: msg.includes("week") ? "weekly" : msg.includes("month") ? "monthly" : msg.includes("quarter") ? "quarterly" : msg.includes("annual") ? "annual" : "daily",
          reportDate: new Date().toISOString().split("T")[0],
        },
      };
    case "summarize":
      return {
        capability,
        payload: {
          scope: msg.includes("crm") || msg.includes("pipeline") ? "crm_pipeline"
            : msg.includes("procur") || msg.includes("purchase") ? "procurement"
            : msg.includes("report") ? "reports"
            : msg.includes("employee") || msg.includes("person") ? "employee"
            : "department",
          employeeId: msg.includes("employee") || msg.includes("person") ? (id || message) : undefined,
        },
      };
    case "propose_action": {
      const wantsTask = /\btask|to-?do\b/.test(msg);
      const dueIn = msg.match(/(?:in|within)\s+(\d+)\s+day/)?.[1];
      const dueDate = new Date(Date.now() + (dueIn ? Number(dueIn) : 7) * 86400000).toISOString().split("T")[0];
      // "for <Name> to|due|by|on …" → assignee name
      const assignee = message.match(/\bfor\s+([a-zA-Z][a-zA-Z]+(?:\s+[a-zA-Z][a-zA-Z]+){0,2})\s+(?:to|due|by|on|before|until)\b/i)?.[1];
      const params = wantsTask
        ? { action: "create_staff_task", params: { employeeId: id || assignee || message, title: message, dueDate } }
        : { action: "post_announcement", params: { title: message.slice(0, 80), message } };
      return { capability, payload: params };
    }
    case "query_data": {
      let query = "department_headcount";
      const params: Record<string, unknown> = {};
      if (/report|compliance/.test(msg) && /(hasn|haven|miss|not submit|who)/.test(msg)) query = "report_compliance";
      else if (/pipeline|deal/.test(msg)) query = "pipeline_summary";
      else if (/overdue/.test(msg)) query = "overdue_tasks";
      else if (/invoice|outstanding|receivable|owed/.test(msg)) query = "outstanding_invoices";
      else if (/leave|absent|off today|holiday/.test(msg)) query = "leave_today";
      else if (/candidate|leaderboard/.test(msg)) query = "candidate_leaderboard";
      const daysMatch = msg.match(/(\d+)\s*day/);
      if (query === "report_compliance" && daysMatch) params.days = Number(daysMatch[1]);
      if (query === "candidate_leaderboard" && id) params.requisitionId = id;
      return { capability, payload: { query, params, question: message } };
    }
    case "proactive_insights": {
      const categories: string[] = [];
      if (/appraisal|performance/.test(msg)) categories.push("appraisals");
      if (/report/.test(msg)) categories.push("reports");
      if (/candidate|recruit|hiring/.test(msg)) categories.push("recruitment");
      if (/crm|lead|deal|pipeline/.test(msg)) categories.push("crm");
      if (/procurement|budget|purchase/.test(msg)) categories.push("procurement");
      if (/attendance|absent/.test(msg)) categories.push("attendance");
      return { capability, payload: categories.length ? { categories } : {} };
    }
    default:
      return { capability: null, payload: {} };
  }
}

// ─── LLM routing ───

function buildRouterPrompt(message: string, hint: AgentCapability | null, conversationContext: string): string {
  const hintClause = hint
    ? `The user explicitly selected the "${hint}" capability. You MUST return that capability; only fill in its payload fields.`
    : `Choose the single best capability. If none clearly fits, return {"capability": null, "payload": {}}.`;

  return `You route a user's request to one capability of an ERP AI agent and extract its parameters.

Capabilities and payload fields:
- screen_candidates {requisitionId} — score/rank/shortlist job applicants for a requisition
- generate_report {transcript, reportType(daily|weekly|monthly|quarterly|annual), reportDate(YYYY-MM-DD)} — turn a dictated/typed account of work into a structured staff report. Use the user's full message as transcript.
- appraise_performance {employeeId, period(weekly|monthly|quarterly|annual)} — generate a performance appraisal for an employee
- summarize {scope(department|crm_pipeline|procurement|reports|employee), departmentId?, employeeId?} — summarize a data scope
- generate_training_plan {employeeId, timelineWeeks} — training plan from appraisal improvement areas
- proactive_insights {categories?} — detect anomalies/risks. categories subset of: appraisals, reports, recruitment, crm, procurement, attendance
- propose_action {action, params} — STAGE a write for confirmation (never executes immediately). action: create_staff_task {employeeId, title, dueDate, description?, frequency?} | post_announcement {title, message, priority?}
- query_data {query, params?, question} — answer questions about tenant data via safe predefined queries: report_compliance {days?}, department_headcount, pipeline_summary, overdue_tasks, outstanding_invoices, leave_today, candidate_leaderboard {requisitionId?}

${hintClause}

Rules:
- Respond with ONLY JSON: {"capability": "<name|null>", "payload": {...}, "rationale": "<one short sentence>"}
- Copy identifiers verbatim (e.g. REQ-12, emp ids, emails). If the user names a person instead of an id, put their name in employeeId.
- Resolve pronouns/references ("them", "that requisition", "his team") using the conversation context when present.${conversationContext}

User message:
"""
${message}
"""`;
}

/**
 * Route a free-text message to a capability + payload.
 * `hint` forces a capability (user picked one in the UI) — only payload is derived.
 */
export async function routeIntent(
  message: string,
  opts?: { hint?: AgentCapability | null; conversationContext?: string; useAI?: boolean },
): Promise<RoutedIntent> {
  const hint = opts?.hint ?? null;
  const trimmed = message.trim();
  if (!trimmed) return { capability: hint, payload: {} };
  if (opts?.useAI === false) return fallbackRoute(trimmed, hint);

  try {
    const content = await callLLM(
      [{ role: "user", content: buildRouterPrompt(trimmed, hint, opts?.conversationContext ?? "") }],
      { temperature: 0.1, maxTokens: 800, jsonMode: true, model: GROQ_MODEL_FAST },
    );
    if (content) {
      const parsed = extractJSON(content) ?? (() => { try { return JSON.parse(content); } catch { return null; } })();
      if (parsed && typeof parsed === "object") {
        const capability = hint ?? normalizeCapability((parsed as any).capability);
        const payload = (parsed as any).payload;
        if (capability) {
          return {
            capability,
            payload: payload && typeof payload === "object" ? payload : {},
            rationale: typeof (parsed as any).rationale === "string" ? (parsed as any).rationale : undefined,
          };
        }
        return { capability: null, payload: {}, rationale: (parsed as any).rationale };
      }
    }
  } catch {
    // fall through to keyword routing
  }

  return fallbackRoute(trimmed, hint);
}
