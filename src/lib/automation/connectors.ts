import { AutomationAction } from "../automation";
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

async function postWebhook(action: AutomationAction): Promise<ActionHandlerResult> {
  const payload = action.action_payload || {};
  const params = payload.params || {};
  const url = params.url;
  if (!url || typeof url !== "string") {
    return { status: "failed", error: "webhook:post requires params.url" };
  }
  try {
    const res = await fetch(url, {
      method: params.method || "POST",
      headers: params.headers || { "Content-Type": "application/json" },
      body: params.body ? JSON.stringify(params.body) : undefined,
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
  const params = payload.params || {};
  console.log("[automation notify]", action.tenant_slug, action.action_type, params.message || params);
  return { status: "completed" } as ActionHandlerResult;
}

async function createTask(action: AutomationAction) {
  // Placeholder for real task system; pretend to enqueue.
  const payload = action.action_payload || {};
  const params = payload.params || {};
  console.log("[automation task:create]", params.title || params);
  return { status: "completed" } as ActionHandlerResult;
}

async function attendanceFlag(action: AutomationAction) {
  const payload = action.action_payload || {};
  const params = payload.params || {};
  console.log("[automation attendance.flag]", params.employeeId, params.reason || "no reason provided");
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
  const payload = action.action_payload || {};
  const params = payload.params || {};
  if (params.policyKey) {
    const decision = await evaluatePolicyDecision({
      tenantSlug: action.tenant_slug,
      policyKey: params.policyKey,
      context: params.context || {},
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
