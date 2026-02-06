import { AutomationAction } from "@/lib/automation/types";
import { evaluatePolicyDecision } from "@/lib/policy/evaluator";

type ActionHandlerResult = { status: "completed" | "failed"; error?: string };
type ActionHandler = (action: AutomationAction) => Promise<ActionHandlerResult>;

type PolicyEvaluationInput = {
  policyName: string;
  tenantSlug: string;
  context: Record<string, any>;
};

type PolicyEvaluationResult = {
  allowed: boolean;
  reason?: string;
};

async function postWebhook(action: AutomationAction) {
  const payload = action.action_payload || {};
  const url = payload.url;
  if (!url || typeof url !== "string") {
    return { status: "failed", error: "webhook:post requires payload.url" } as ActionHandlerResult;
  }
  try {
    const res = await fetch(url, {
      method: payload.method || "POST",
      headers: payload.headers || { "Content-Type": "application/json" },
      body: payload.body ? JSON.stringify(payload.body) : undefined,
    });
    if (!res.ok) {
      return { status: "failed", error: `Webhook responded ${res.status}` };
    }
    return { status: "completed" };
  } catch (err: any) {
    return { status: "failed", error: err?.message || String(err) };
  }
}

async function logNotification(action: AutomationAction) {
  const payload = action.action_payload || {};
  console.log("[automation notify]", action.tenant_slug, action.action_type, payload.message || payload);
  return { status: "completed" } as ActionHandlerResult;
}

async function createTask(action: AutomationAction) {
  // Placeholder for real task system; pretend to enqueue.
  const payload = action.action_payload || {};
  console.log("[automation task:create]", payload.title || payload);
  return { status: "completed" } as ActionHandlerResult;
}

async function attendanceFlag(action: AutomationAction) {
  const payload = action.action_payload || {};
  console.log("[automation attendance.flag]", payload.employeeId, payload.reason || "no reason provided");
  return { status: "completed" } as ActionHandlerResult;
}

const handlers: Record<string, ActionHandler> = {
  "webhook:post": postWebhook,
  "notify:log": logNotification,
  "email:send": logNotification,
  "task:create": createTask,
  "attendance:flag": attendanceFlag,
};

export async function handleAutomationAction(action: AutomationAction): Promise<ActionHandlerResult> {
  if (action.action_payload?.policyKey) {
    const decision = await evaluatePolicyDecision({
      tenantSlug: action.tenant_slug,
      policyKey: action.action_payload.policyKey,
      context: action.action_payload.context || {},
    });
    if (!decision.allowed) {
      return { status: "failed", error: decision.reason || "policy denied" };
    }
  }
  const handler = handlers[action.action_type];
  if (!handler) return { status: "failed", error: `No handler for ${action.action_type}` };
  try {
    return await handler(action);
  } catch (err: any) {
    return { status: "failed", error: err?.message || String(err) };
  }
}

export async function evaluatePolicyDecision(input: PolicyEvaluationInput): Promise<PolicyEvaluationResult> {
  // Placeholder; return allow until enforcement layer is added.
  console.log("Policy evaluation placeholder", input);
  return { allowed: true, reason: "Default allow (placeholder)" };
}
