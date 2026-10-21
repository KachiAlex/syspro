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

/**
 * SSRF guard for webhook actions. Automation rules can be authored by any
 * tenant admin, so an unguarded fetch is a server-side request forgery
 * primitive (cloud metadata, internal services, the app's own API).
 *
 * Policy: http/https on 80/443 only; loopback/private/link-local/reserved
 * hosts are always blocked. When AUTOMATION_WEBHOOK_ALLOWLIST is set
 * (comma-separated hostnames, `*.` prefix = subdomain wildcard), the host
 * must also match an entry.
 */
export function webhookUrlAllowed(rawUrl: string): { ok: boolean; reason?: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "invalid URL" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "only http/https webhooks are allowed" };
  }
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  if (port !== "443" && port !== "80") {
    return { ok: false, reason: "only ports 80/443 are allowed" };
  }
  const host = url.hostname.toLowerCase();

  // Block literal IPs in private/reserved ranges and loopback names.
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, reason: "local hostnames are not allowed" };
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    const privateRanges =
      a === 10 || a === 127 || a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||   // link-local + cloud metadata
      (a === 100 && b >= 64 && b <= 127); // CGNAT (incl. Tailscale)
    if (privateRanges) return { ok: false, reason: "private/reserved IP ranges are not allowed" };
  }
  if (host.includes(":")) {
    // IPv6 literal — block loopback/ULA/link-local outright.
    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
      return { ok: false, reason: "private/reserved IPv6 addresses are not allowed" };
    }
  }

  const allowlist = (process.env.AUTOMATION_WEBHOOK_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length > 0) {
    const allowed = allowlist.some((entry) =>
      entry.startsWith("*.") ? host === entry.slice(2) || host.endsWith(entry.slice(1)) : host === entry
    );
    if (!allowed) return { ok: false, reason: `host '${host}' is not in AUTOMATION_WEBHOOK_ALLOWLIST` };
  }
  return { ok: true };
}

async function postWebhook(action: AutomationAction): Promise<ActionHandlerResult> {
  const payload = action.action_payload || {};
  const params = payload.params || {};
  const url = params.url;
  if (!url || typeof url !== "string") {
    return { status: "failed", error: "webhook:post requires params.url" };
  }
  const verdict = webhookUrlAllowed(url);
  if (!verdict.ok) {
    return { status: "failed", error: `Webhook URL rejected: ${verdict.reason}` };
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
  const payload = action.action_payload || {};
  const params = payload.params || {};
  const tenantSlug = action.tenant_slug;
  const title = String(params.title || "Automation task");
  const employeeId = params.employeeId
    ? String(params.employeeId)
    : payload.event?.payload?.employeeId
      ? String(payload.event.payload.employeeId)
      : null;
  if (!employeeId) {
    return { status: "failed", error: "task:create requires params.employeeId or event payload employeeId" } as ActionHandlerResult;
  }
  const { sql: SQL } = await import("@/lib/sql-client");
  const { randomUUID } = await import("crypto");
  await SQL`
    insert into admin_staff_tasks
      (id, tenant_slug, employee_id, title, description, frequency, due_date, status, assigned_by, expected_outcome, created_at, updated_at)
    values (
      ${randomUUID()}, ${tenantSlug}, ${employeeId}, ${title},
      ${params.description ? String(params.description) : null},
      ${["daily","weekly","monthly","quarterly","annual","one-time"].includes(String(params.frequency)) ? String(params.frequency) : "one-time"},
      ${params.dueDate ? String(params.dueDate) : null},
      'pending',
      ${payload.event?.actor ? String(payload.event.actor) : "automation"},
      ${params.expectedOutcome ? String(params.expectedOutcome) : null},
      now(), now()
    )
  `;
  return { status: "completed" } as ActionHandlerResult;
}

async function attendanceFlag(action: AutomationAction) {
  const payload = action.action_payload || {};
  const params = payload.params || {};
  const tenantSlug = action.tenant_slug;
  const employeeId = params.employeeId ?? payload.event?.payload?.employeeId;
  if (!employeeId) {
    return { status: "failed", error: "attendance:flag requires employeeId" } as ActionHandlerResult;
  }
  const reason = String(params.reason || "flagged by automation rule");
  const workDate = params.workDate ?? payload.event?.payload?.workDate ?? null;
  const { sql: SQL } = await import("@/lib/sql-client");
  const result = workDate
    ? ((await SQL`
        update attendance_records
        set check_in_flagged = true, flag_reason = ${reason}, updated_at = now()
        where tenant_id = ${tenantSlug} and employee_id = ${String(employeeId)} and work_date = ${String(workDate)}::date
        returning id
      `) as any[])
    : ((await SQL`
        update attendance_records
        set check_in_flagged = true, flag_reason = ${reason}, updated_at = now()
        where id = (
          select id from attendance_records
          where tenant_id = ${tenantSlug} and employee_id = ${String(employeeId)}
          order by work_date desc limit 1
        )
        returning id
      `) as any[]);
  if (result.length === 0) {
    return { status: "failed", error: "no attendance record found to flag" } as ActionHandlerResult;
  }
  return { status: "completed" } as ActionHandlerResult;
}

const handlers: Record<string, ActionHandler> = {
  "webhook:post": postWebhook,
  "notify:log": logNotification,
  "email:send": logNotification,
  "task:create": createTask,
  "attendance:flag": attendanceFlag,
};

export const KNOWN_ACTION_TYPES = new Set(Object.keys(handlers));

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
