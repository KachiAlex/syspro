export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAgent, CAPABILITY_DEFINITIONS, getConversationHistory, buildConversationContext, GROQ_MODEL, resolveEmployee, resolveEmployeeGroup, type AgentCapability } from "@/lib/ai/agent";
import { createPlan, applyPriorResult, parseScoreThreshold, type PlanStep } from "@/lib/ai/planner";
import { authenticateAgent } from "@/lib/ai/agent-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// ─── Auth ───

const authenticate = authenticateAgent;

// Self-service scoping: regular employees may only run self-scoped capabilities.
const PRIVILEGED_ROLES = new Set(["admin", "tenant_admin", "executive", "hod", "hr", "hr_admin", "hr_manager"]);
const SELF_SERVICE_CAPABILITIES = new Set(["generate_report", "summarize", "appraise_performance", "generate_training_plan"]);

function isPrivileged(auth: { authMethod: string; employeeRole?: string }): boolean {
  return auth.authMethod === "api_key" || PRIVILEGED_ROLES.has((auth.employeeRole ?? "").toLowerCase());
}

/** Force self-scope on the payload for non-privileged session users. */
function scopeToSelf(payload: Record<string, unknown>, capability: string, employeeId?: string): Record<string, unknown> {
  if (!employeeId) return payload;
  const p = { ...payload };
  if (capability === "summarize") {
    p.scope = "employee";
    p.employeeId = employeeId;
  } else if (capability === "appraise_performance" || capability === "generate_training_plan") {
    p.employeeId = employeeId;
    delete p.appraisalId; // can't point at someone else's appraisal
  }
  return p;
}

// ─── Group fan-out ───
// Employee-scoped capabilities accept a group ref ("the sales team",
// "finance department", "everyone") in employeeId — resolved to a bounded
// set of per-employee executions aggregated into one step result.

const GROUP_SCOPED = new Set<string>(["appraise_performance", "generate_training_plan"]);
const MAX_GROUP_RUN = 10;

interface RunArgs {
  tenantSlug: string;
  useAI?: boolean;
  conversationId?: string;
  actor: { id?: string; role?: string; authMethod?: string };
}

async function runEmployeeSteps(
  step: PlanStep,
  targets: Array<{ id: string; name?: string; extra?: Record<string, unknown> }>,
  label: string | undefined,
  runArgs: RunArgs,
) {
  const capped = targets.slice(0, MAX_GROUP_RUN);
  const CHUNK = 4;
  const items: Array<{ employeeId: string; name?: string; success: boolean; result?: unknown; error?: string }> = [];
  for (let i = 0; i < capped.length; i += CHUNK) {
    const batch = await Promise.all(
      capped.slice(i, i + CHUNK).map(async (emp) => {
        const payload = { ...step.payload, employeeId: emp.id, ...(emp.extra ?? {}) };
        const r: any = await runAgent({ capability: step.capability, payload, ...runArgs }).catch((e: any) => ({
          success: false,
          error: e?.message ?? "step failed",
          result: undefined,
        }));
        return { employeeId: emp.id, name: emp.name, success: r?.success ?? false, result: r?.result, error: r?.error };
      }),
    );
    items.push(...batch);
  }
  const succeeded = items.filter((i) => i.success).length;
  const result: Record<string, unknown> = {
    fannedOut: true,
    ...(label ? { group: label } : {}),
    total: items.length,
    succeeded,
    truncated: targets.length > MAX_GROUP_RUN,
    items,
  };
  if (step.capability === "appraise_performance") {
    // Feed-forward surface for chained training plans / summaries.
    result.appraisals = items.map((i) => ({
      employeeId: i.employeeId,
      name: i.name,
      success: i.success,
      overallScore: (i.result as any)?.overallScore,
      rating: (i.result as any)?.rating,
      appraisalId: (i.result as any)?.appraisalId,
      improvements: (i.result as any)?.improvements,
      error: i.error,
    }));
  }
  return { success: succeeded > 0, capability: step.capability, result };
}

/** If the step's employeeId names a group rather than a person, fan out.
 *  Otherwise canonicalize name → id and return null (run the step normally). */
async function resolveGroupFanOut(step: PlanStep, tenantSlug: string, runArgs: RunArgs) {
  if (!GROUP_SCOPED.has(step.capability)) return null;
  // LLM plans may put the group in department instead of employeeId.
  const empRef = step.payload.employeeId ?? step.payload.department ?? step.payload.team;
  if (typeof empRef !== "string" || !empRef.trim()) return null;
  const { sql: SQL } = await import("@/lib/sql-client");
  const single = await resolveEmployee(SQL, tenantSlug, empRef).catch(() => null);
  if (single) {
    step.payload.employeeId = single.id;
    return null;
  }
  const group = await resolveEmployeeGroup(SQL, tenantSlug, empRef).catch(() => null);
  if (!group?.employees?.length) return null;
  return runEmployeeSteps(step, group.employees, group.label, runArgs);
}

/** A step needs prior-step output when a required identifier is missing. */
function stepNeedsFeedForward(s: PlanStep): boolean {
  if (s.capability === "screen_candidates") return !s.payload.requisitionId;
  if (GROUP_SCOPED.has(s.capability)) return !s.payload.employeeId;
  return false;
}

// ─── Request Schema ───

const MAX_PAYLOAD_SIZE = 50_000;

const capabilityEnum = z.enum([
  "screen_candidates",
  "generate_report",
  "appraise_performance",
  "summarize",
  "generate_training_plan",
  "proactive_insights",
  "propose_action",
  "query_data",
]);

const agentSchema = z.object({
  capability: capabilityEnum.optional(),
  payload: z.record(z.unknown()).optional(),
  message: z.string().min(1).max(10_000).optional(),
  tenantSlug: z.string().min(1).max(100).optional(),
  useAI: z.boolean().optional(),
  conversationId: z.string().max(200).optional(),
}).refine((data) => data.message || (data.capability && data.payload), {
  message: "Provide either a free-text 'message' or 'capability' + 'payload'",
}).refine((data) => JSON.stringify(data.payload ?? {}).length <= MAX_PAYLOAD_SIZE, {
  message: `Payload exceeds maximum size of ${MAX_PAYLOAD_SIZE} bytes`,
});

// ─── POST: Execute Agent ───

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof NextResponse) return auth;
  if (!auth) {
    return NextResponse.json(
      {
        error: "Authentication required. Provide x-api-key header (with x-tenant-slug) or a valid session cookie.",
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = agentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Use tenantSlug from auth if not provided in body
  const tenantSlug = parsed.data.tenantSlug || auth.tenantSlug;
  if (auth.authMethod === "api_key" && !tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required in body or x-tenant-slug header" }, { status: 400 });
  }

  // Free-text message → planner. An explicit capability acts as a hint:
  // the planner returns a single step that only fills the payload.
  if (parsed.data.message) {
    const conversationContext = parsed.data.conversationId
      ? await buildConversationContext(parsed.data.conversationId, tenantSlug).catch(() => "")
      : "";
    const plan = await createPlan(parsed.data.message, {
      hint: (parsed.data.capability as AgentCapability) ?? null,
      conversationContext,
      useAI: parsed.data.useAI,
    });
    if (plan.steps.length > 0) {
      console.log("[agent] plan:", JSON.stringify(plan.steps.map((s) => ({ cap: s.capability, payload: s.payload }))));
    }
    if (plan.steps.length === 0) {
      return NextResponse.json({
        success: true,
        capability: null,
        result: {
          reply:
            "I can screen candidates, generate staff reports, appraise performance, " +
            "summarize a department/CRM pipeline/procurement, draft training plans, " +
            "or scan for anomalies. What would you like?",
        },
        metadata: { source: "router", generatedAt: new Date().toISOString() },
      });
    }

    // Self-service: non-privileged session users may only run self-scoped steps.
    const selfService = !isPrivileged(auth);
    if (selfService) {
      const blocked = plan.steps.find((s) => !SELF_SERVICE_CAPABILITIES.has(s.capability));
      if (blocked) {
        return NextResponse.json({
          success: true,
          capability: null,
          result: {
            reply: `That request needs a manager or admin role. I can help you draft your reports, ` +
              `summarize your own work, show your appraisals, or draft a training plan for yourself.`,
          },
          metadata: { source: "scope_guard", generatedAt: new Date().toISOString() },
        });
      }
    }

    const scoreThreshold = parseScoreThreshold(parsed.data.message);
    const executedSteps: Array<{ capability: AgentCapability; response: any; skipped?: boolean }> = [];
    const runArgs: RunArgs = {
      tenantSlug,
      useAI: parsed.data.useAI,
      conversationId: parsed.data.conversationId,
      actor: { id: auth.employeeId, role: auth.employeeRole, authMethod: auth.authMethod },
    };
    let failed = false;

    // Parallel path: when every step already carries its own identifiers,
    // no step consumes prior output — run them concurrently.
    const allIndependent = plan.steps.length > 1 && plan.steps.every((s) => !stepNeedsFeedForward(s));

    if (allIndependent) {
      const responses = await Promise.all(
        plan.steps.map(async (rawStep) => {
          if (selfService) {
            rawStep.payload = scopeToSelf(rawStep.payload, rawStep.capability, auth.employeeId);
          }
          const step: PlanStep = { ...rawStep, payload: { ...rawStep.payload } };
          const fanOut = await resolveGroupFanOut(step, tenantSlug, runArgs);
          if (fanOut) return fanOut;
          return runAgent({ capability: step.capability, payload: step.payload, ...runArgs });
        }),
      );
      responses.forEach((response, i) => executedSteps.push({ capability: plan.steps[i].capability, response }));
      failed = responses.some((r) => !r?.success);
    } else {
      for (const rawStep of plan.steps) {
        if (selfService) {
          rawStep.payload = scopeToSelf(rawStep.payload, rawStep.capability, auth.employeeId);
        }
        const step: PlanStep = applyPriorResult(rawStep, executedSteps.map((s) => ({
          capability: s.capability,
          result: s.response?.result,
        })));

        // Chained fan-out: a training plan after a fanned-out appraisal runs
        // once per appraised employee (filtered by the score threshold).
        if (step.capability === "generate_training_plan" && !step.payload.employeeId) {
          const priorAppraisals = executedSteps.flatMap(
            (s) => ((s.response?.result?.appraisals as any[]) ?? []),
          );
          if (priorAppraisals.length > 0) {
            let targets = priorAppraisals.filter((a) => a.success && a.employeeId);
            if (scoreThreshold != null) {
              targets = targets.filter((t) => typeof t.overallScore === "number" && t.overallScore < scoreThreshold);
            }
            if (targets.length === 0) {
              executedSteps.push({
                capability: step.capability,
                response: {
                  success: true,
                  result: { skipped: scoreThreshold != null ? `no appraised scores under ${scoreThreshold}` : "no appraised employees" },
                },
                skipped: true,
              });
              continue;
            }
            const fanOut = await runEmployeeSteps(
              step,
              targets.map((t) => ({
                id: t.employeeId,
                name: t.name,
                extra: { appraisalId: t.appraisalId, focusAreas: t.improvements },
              })),
              undefined,
              runArgs,
            );
            executedSteps.push({ capability: step.capability, response: fanOut });
            if (!fanOut.success) { failed = true; break; }
            continue;
          }
        }

        // Group ref in employeeId ("the sales team") → per-employee fan-out;
        // single name/id → canonicalized in place.
        const fanOut = await resolveGroupFanOut(step, tenantSlug, runArgs);
        if (fanOut) {
          executedSteps.push({ capability: step.capability, response: fanOut });
          if (!fanOut.success) { failed = true; break; }
          continue;
        }

        // Gate follow-on training plans on a score threshold from the request
        // ("training plans for anyone under 60").
        if (step.capability === "generate_training_plan" && scoreThreshold != null) {
          const score = executedSteps
            .map((s) => s.response?.result?.overallScore)
            .find((v) => typeof v === "number");
          if (typeof score === "number" && score >= scoreThreshold) {
            executedSteps.push({
              capability: step.capability,
              response: { success: true, result: { skipped: `score ${score} not under ${scoreThreshold}` } },
              skipped: true,
            });
            continue;
          }
        }

        const r = await runAgent({ capability: step.capability, payload: step.payload, ...runArgs });
        executedSteps.push({ capability: step.capability, response: r });
        if (!r?.success) {
          failed = true;
          break; // stop the chain on first hard failure
        }
      }
    }

    // Single step → return the plain AgentResponse shape (backward compat).
    if (plan.steps.length === 1) {
      const single = executedSteps[0]?.response ?? { success: false, error: "No steps executed" };
      if (plan.rationale && typeof single === "object") {
        (single as any).routedIntent = { rationale: plan.rationale };
      }
      return NextResponse.json(single, { status: single.success ? 200 : 500 });
    }

    // Multi-step → composed plan response.
    const executed = executedSteps.filter((s) => !s.skipped);
    const failStep = failed
      ? executedSteps.find((s) => !s.skipped && !s.response?.success) ?? executedSteps[executedSteps.length - 1]
      : null;
    return NextResponse.json(
      {
        success: !failed,
        capability: "plan",
        result: {
          summary: failStep
            ? `Plan stopped at ${failStep.capability}: ${failStep.response?.error || "step failed"}.`
            : `Executed ${executed.length} step(s)${executedSteps.length > executed.length ? `, skipped ${executedSteps.length - executed.length}` : ""}.`,
          steps: executedSteps.map((s) => ({
            capability: s.capability,
            skipped: !!s.skipped,
            success: s.response?.success ?? false,
            result: s.response?.result,
            ...(s.response?.error ? { error: s.response.error } : {}),
          })),
          ...(plan.rationale ? { rationale: plan.rationale } : {}),
        },
        metadata: {
          source: "plan",
          planSteps: plan.steps.length,
          generatedAt: new Date().toISOString(),
          conversationId: parsed.data.conversationId,
        },
      },
      { status: failed ? 500 : 200 },
    );
  }

  // Direct capability path — apply self-service scope for non-privileged sessions.
  const directCapability = parsed.data.capability as AgentCapability;
  if (!isPrivileged(auth)) {
    if (!SELF_SERVICE_CAPABILITIES.has(directCapability)) {
      return NextResponse.json(
        { error: `Capability "${directCapability}" requires a manager or admin role.` },
        { status: 403 },
      );
    }
    parsed.data.payload = scopeToSelf(parsed.data.payload ?? {}, directCapability, auth.employeeId);
  }

  const result = await runAgent({
    capability: directCapability,
    payload: parsed.data.payload ?? {},
    tenantSlug,
    useAI: parsed.data.useAI,
    conversationId: parsed.data.conversationId,
    actor: { id: auth.employeeId, role: auth.employeeRole, authMethod: auth.authMethod },
  });

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

// ─── GET: List Capabilities ───

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof NextResponse) return auth;
  if (!auth) {
    return NextResponse.json(
      {
        error: "Authentication required. Provide x-api-key header (with x-tenant-slug) or a valid session cookie.",
      },
      { status: 401 },
    );
  }

  const conversationId = request.nextUrl.searchParams.get("conversationId");

  if (conversationId) {
    const history = await getConversationHistory(conversationId, auth.tenantSlug);
    return NextResponse.json({ conversationId, turns: history });
  }

  return NextResponse.json({
    agent: "Syspro AI Agent",
    version: "1.2.0",
    capabilities: CAPABILITY_DEFINITIONS.map((c) => ({
      name: c.name,
      description: c.description,
      inputSchema: c.inputSchema,
      outputDescription: c.outputDescription,
    })),
    model: GROQ_MODEL,
    provider: "groq",
    authMethods: ["api_key", "session"],
    features: ["intent_router", "conversation_memory", "deterministic_fallbacks", "mcp_compatible"],
    usage: {
      freeText: "POST {message: '...', capability?: <hint>, conversationId?}",
      direct: "POST {capability: '<name>', payload: {...}}",
    },
    endpoints: {
      execute: "POST /api/ai/agent",
      capabilities: "GET /api/ai/agent",
      conversation: "GET /api/ai/agent?conversationId=<id>",
      mcp: "GET /api/ai/agent/mcp",
    },
  });
}
