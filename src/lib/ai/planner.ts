/**
 * Multi-step planner — decomposes a request into a bounded sequence of
 * capabilities executed in order. Each step's result feeds forward via
 * safe, predefined field mappings (never arbitrary result injection).
 *
 * LLM path produces the step list in json mode; a deterministic fallback
 * covers the known chains when Groq is unavailable.
 */

import { callLLM, extractJSON, type AgentCapability } from "./agent";
import { routeIntent } from "./intent-router";

export const MAX_PLAN_STEPS = 4;

export interface PlanStep {
  capability: AgentCapability;
  payload: Record<string, unknown>;
}

export interface AgentPlan {
  steps: PlanStep[];
  rationale?: string;
}

const VALID_CAPABILITIES = new Set<string>([
  "screen_candidates",
  "generate_report",
  "appraise_performance",
  "summarize",
  "generate_training_plan",
  "proactive_insights",
  "propose_action",
  "query_data",
]);

function normalizeSteps(raw: unknown): PlanStep[] {
  if (!Array.isArray(raw)) return [];
  const steps: PlanStep[] = [];
  for (const item of raw) {
    if (steps.length >= MAX_PLAN_STEPS) break;
    if (!item || typeof item !== "object") continue;
    const cap = String((item as any).capability ?? "");
    if (!VALID_CAPABILITIES.has(cap)) continue;
    const payload = (item as any).payload;
    steps.push({
      capability: cap as AgentCapability,
      payload: payload && typeof payload === "object" ? payload : {},
    });
  }
  return steps;
}

// ─── Deterministic fallback plan ───

function fallbackPlan(message: string, hint: AgentCapability | null, single: { capability: AgentCapability | null; payload: Record<string, unknown> }): AgentPlan {
  const msg = message.toLowerCase();
  const wantsAppraisal = /\bapprais\w*|performance review|evaluat\w*/.test(msg);
  const wantsTraining = /training plan|learning plan|upskill\w*/.test(msg);

  // appraise → training plan chain
  if (!hint && wantsAppraisal && wantsTraining) {
    const appraise = single.capability === "appraise_performance" ? single.payload : {};
    return {
      steps: [
        { capability: "appraise_performance", payload: appraise.employeeId ? appraise : { employeeId: message, period: "monthly" } },
        { capability: "generate_training_plan", payload: {} }, // employeeId fed forward from step 1
      ],
      rationale: "Appraise, then draft a training plan from the outcome",
    };
  }

  if (single.capability) {
    return { steps: [{ capability: single.capability, payload: single.payload }] };
  }
  return { steps: [] };
}

// ─── LLM plan ───

function buildPlanPrompt(message: string, hint: AgentCapability | null, conversationContext: string): string {
  const hintClause = hint
    ? `The user explicitly selected "${hint}". Return a single step with that capability and a filled payload.`
    : `Decompose the request into 1-${MAX_PLAN_STEPS} steps, executed in order. A single step is correct for simple requests. If nothing fits, return {"steps": []}.`;

  return `You plan a sequence of capability calls for an ERP AI agent.

Capabilities and payload fields:
- screen_candidates {requisitionId} — score/rank/shortlist applicants for a requisition
- generate_report {transcript, reportType(daily|weekly|monthly|quarterly|annual), reportDate(YYYY-MM-DD)} — dictated work → structured staff report
- appraise_performance {employeeId, period(weekly|monthly|quarterly|annual)} — performance appraisal for an employee
- summarize {scope(department|crm_pipeline|procurement|reports|employee), departmentId?, employeeId?} — summarize a data scope
- generate_training_plan {employeeId, timelineWeeks} — training plan from appraisal results
- proactive_insights {categories?} — anomaly/risk scan
- propose_action {action, params} — STAGE a confirmed write: create_staff_task {employeeId, title, dueDate, description?, frequency?} | post_announcement {title, message, priority?}. Use when the user asks to create/assign/post something.
- query_data {query, params?, question} — answer data questions via safe predefined queries: report_compliance {days?}, department_headcount, pipeline_summary, overdue_tasks, outstanding_invoices, leave_today, candidate_leaderboard {requisitionId?}

${hintClause}

Rules:
- Respond with ONLY JSON: {"steps": [{"capability": "<name>", "payload": {...}}], "rationale": "<one short sentence>"}
- Only chain steps when the user asks for multiple distinct actions. Prefer the fewest steps that satisfy the request.
- When a step needs an identifier produced by a previous step (e.g. employeeId, requisitionId), leave that field out — results feed forward automatically.
- Copy identifiers verbatim (REQ-12, emp ids, names). Names go in employeeId.
- Resolve pronouns/references using conversation context when present.${conversationContext}

User message:
"""
${message}
"""`;
}

/**
 * Build a bounded execution plan for a free-text message.
 */
export async function createPlan(
  message: string,
  opts?: { hint?: AgentCapability | null; conversationContext?: string; useAI?: boolean },
): Promise<AgentPlan> {
  const hint = opts?.hint ?? null;
  const trimmed = message.trim();
  if (!trimmed) return { steps: [] };

  if (opts?.useAI !== false) {
    try {
      const content = await callLLM(
        [{ role: "user", content: buildPlanPrompt(trimmed, hint, opts?.conversationContext ?? "") }],
        { temperature: 0.1, maxTokens: 1200, jsonMode: true },
      );
      if (content) {
        const parsed = extractJSON(content) ?? (() => { try { return JSON.parse(content); } catch { return null; } })();
        const steps = normalizeSteps((parsed as any)?.steps);
        if (steps.length > 0) {
          if (hint && steps[0].capability !== hint) {
            steps.splice(0, steps.length, { capability: hint, payload: steps[0].payload });
          }
          return { steps, rationale: typeof (parsed as any).rationale === "string" ? (parsed as any).rationale : undefined };
        }
      }
    } catch {
      // fall through to deterministic plan
    }
  }

  const single = await routeIntent(trimmed, { hint, conversationContext: opts?.conversationContext, useAI: false });
  return fallbackPlan(trimmed, hint, single);
}

// ─── Safe feed-forward between steps ───

const FEED_FORWARD_KEYS = ["employeeId", "requisitionId", "appraisalId", "departmentId"] as const;

/**
 * Fill only missing payload fields on `next` from a prior step's result.
 * Bounded to a fixed key allowlist — never injects raw result blobs.
 */
export function applyPriorResult(
  next: PlanStep,
  priorResults: Array<{ capability: AgentCapability; result: unknown }>,
): PlanStep {
  const payload = { ...next.payload };
  for (const { result } of priorResults) {
    if (!result || typeof result !== "object") continue;
    for (const key of FEED_FORWARD_KEYS) {
      if (payload[key] == null && (result as any)[key] != null) {
        payload[key] = (result as any)[key];
      }
    }
    // appraisal → training plan: reuse identified weak areas as focus areas
    if (next.capability === "generate_training_plan" && payload.focusAreas == null) {
      const areas = (result as any).improvements ?? (result as any).improvementAreas;
      if (Array.isArray(areas) && areas.length > 0) payload.focusAreas = areas;
    }
  }
  return { ...next, payload };
}

/**
 * Parse a conditional threshold from the request, e.g. "training plans for
 * anyone under 60" → 60. Used to gate follow-on steps on a score.
 */
export function parseScoreThreshold(message: string): number | null {
  const m = message.match(/(?:under|below|less than|scor\w*)\s*(\d{1,3})/i)
    || message.match(/(\d{1,3})\s*(?:or (?:lower|less)|and (?:below|under))/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 0 && n <= 100 ? n : null;
}
