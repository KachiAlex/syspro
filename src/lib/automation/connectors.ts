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
  const tenantSlug = action.tenant_slug;
  const title = String(params.title || "Automation notification");
  const message = String(params.message || params.body || title);
  const category = ["hr", "finance", "crm", "projects", "system", "general"].includes(params.category)
    ? params.category
    : "system";
  const type = ["info", "success", "warning", "error"].includes(params.type) ? params.type : "info";

  // Resolve recipients: explicit employee(s), a role, a broadcast, or the
  // actor who triggered the event.
  const { sql: SQL } = await import("@/lib/sql-client");
  const { insertNotification } = await import("@/lib/hr/db");
  let employeeIds: string[] = [];
  if (Array.isArray(params.employeeIds)) {
    employeeIds = params.employeeIds.map(String);
  } else if (params.employeeId) {
    employeeIds = [String(params.employeeId)];
  } else if (params.role) {
    const rows = (await SQL`
      select id from admin_employees
      where tenant_slug = ${tenantSlug} and role = ${String(params.role)} and status = 'active'
    `) as any[];
    employeeIds = rows.map((r) => r.id);
  } else if (params.broadcast === true) {
    const rows = (await SQL`
      select id from admin_employees
      where tenant_slug = ${tenantSlug} and status = 'active'
    `) as any[];
    employeeIds = rows.map((r) => r.id);
  } else if (params.recipient === "actor" && payload.event?.actor) {
    employeeIds = [String(payload.event.actor)];
  }

  if (employeeIds.length === 0) {
    return { status: "failed", error: "notify requires employeeId, employeeIds, role, broadcast, or recipient:'actor'" } as ActionHandlerResult;
  }

  for (const employeeId of employeeIds.slice(0, 200)) {
    await insertNotification({
      tenantSlug,
      employeeId,
      type,
      category,
      title,
      message,
      actionUrl: params.actionUrl ?? null,
    });
  }
  console.log("[automation notify]", tenantSlug, action.action_type, `-> ${employeeIds.length} recipient(s)`);
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
