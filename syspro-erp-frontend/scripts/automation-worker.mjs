#!/usr/bin/env node
import { Client } from "pg";

const ACTION_HANDLERS = {
  "webhook:post": async (action) => {
    const payload = action.action_payload || {};
    const url = payload.url;
    if (!url) return { ok: false, error: "webhook:post requires payload.url" };
    const res = await fetch(url, {
      method: payload.method || "POST",
      headers: payload.headers || { "Content-Type": "application/json" },
      body: payload.body ? JSON.stringify(payload.body) : undefined,
    });
    if (!res.ok) return { ok: false, error: `Webhook responded ${res.status}` };
    return { ok: true };
  },
  "notify:log": async (action) => {
    console.log("[automation notify]", action.tenant_slug, action.action_payload?.message || action.action_payload);
    return { ok: true };
  },
  "email:send": async (action) => {
    console.log("[automation email]", action.action_payload);
    return { ok: true };
  },
  "task:create": async (action) => {
    console.log("[automation task:create]", action.action_payload?.title || action.action_payload);
    return { ok: true };
  },
  "attendance:flag": async (action) => {
    console.log("[automation attendance.flag]", action.action_payload);
    return { ok: true };
  },
};

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const ACTION_BATCH_SIZE = Number(process.env.AUTOMATION_BATCH_SIZE || 25);
const REPORT_BATCH_SIZE = Number(process.env.REPORT_BATCH_SIZE || 10);
const ACTION_MAX_RETRIES = Number(process.env.AUTOMATION_MAX_RETRIES || 2);
const REPORT_MAX_RETRIES = Number(process.env.REPORT_MAX_RETRIES || 1);
const RETRY_DELAY_MS = Number(process.env.AUTOMATION_RETRY_DELAY_MS || 500);
const ACTION_MAX_ATTEMPTS = Number(process.env.AUTOMATION_MAX_ATTEMPTS || 5);
const REPORT_MAX_ATTEMPTS = Number(process.env.REPORT_MAX_ATTEMPTS || 3);
const REPORT_UPLOAD_BASE_URL = process.env.REPORT_UPLOAD_BASE_URL;
const REPORT_UPLOAD_URL = process.env.REPORT_UPLOAD_URL; // optional presigned URL
const REPORT_UPLOAD_METHOD = process.env.REPORT_UPLOAD_METHOD || "PUT";
const REPORT_UPLOAD_HEADERS = process.env.REPORT_UPLOAD_HEADERS;

async function withClient(fn) {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function fetchPendingActions(client) {
  const { rows } = await client.query(
    `select * from automation_action_queue
     where status = 'pending' and (scheduled_for is null or scheduled_for <= now()) and attempt_count < $2
     order by created_at asc
     limit $1
     for update skip locked`,
    [ACTION_BATCH_SIZE, ACTION_MAX_ATTEMPTS]
  );
  return rows;
}

async function markActionStatus(client, id, status, error = null, incrementAttempt = false) {
  await client.query(
    `update automation_action_queue
     set ${incrementAttempt ? "attempt_count = attempt_count + 1," : ""} status = $1, error = $2, updated_at = now()
     where id = $3`,
    [status, error, id]
  );
}

async function handleAction(row, client) {
  const payload = typeof row.action_payload === "string" ? safeJson(row.action_payload) : row.action_payload;
  const action = { ...row, action_payload: payload };
  if (action.action_payload?.policyKey) {
    const decision = await evaluatePolicyDecision(client, action.tenant_slug, action.action_payload.policyKey, action.action_payload.context || {});
    if (!decision.allowed) return { ok: false, error: decision.reason || "policy denied" };
  }
  const handler = ACTION_HANDLERS[action.action_type];
  if (!handler) return { ok: false, error: `No handler for ${action.action_type}` };
  return handler(action);
}

async function withRetries(label, maxRetries, fn) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > maxRetries) throw err;
      logWarn(`${label} failed attempt ${attempt}/${maxRetries}: ${err?.message || err}`);
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logInfo(msg, meta = {}) {
  console.log(JSON.stringify({ level: "info", msg, ...meta }));
}

function logWarn(msg, meta = {}) {
  console.warn(JSON.stringify({ level: "warn", msg, ...meta }));
}

function logError(msg, meta = {}) {
  console.error(JSON.stringify({ level: "error", msg, ...meta }));
}

async function evaluatePolicyDecision(client, tenantSlug, policyKey, context) {
  // Lightweight evaluator: look up latest published policy and apply allow/deny conditions.
  const policy = await fetchLatestPolicy(client, tenantSlug, policyKey);
  if (!policy) return { allowed: true, reason: "no policy" };
  if (policy.status !== "published") return { allowed: true, reason: "policy not published" };
  return applyPolicyDocument(policy.document, context);
}

async function fetchLatestPolicy(client, tenantSlug, policyKey) {
  const { rows } = await client.query(
    `select p.status, pv.document, pv.version
     from policies p
     join policy_versions pv on p.id = pv.policy_id
     where p.tenant_slug = $1 and p.policy_key = $2
     order by pv.version desc
     limit 1`,
    [tenantSlug, policyKey]
  );
  return rows[0];
}

function applyPolicyDocument(doc, context) {
  if (!doc) return { allowed: true, reason: "no policy document" };
  const deny = Array.isArray(doc.deny) ? doc.deny : [];
  const allow = Array.isArray(doc.allow) ? doc.allow : [];
  const defaultDecision = doc.default === "deny" ? "deny" : "allow";

  if (deny.some((c) => evaluateCondition(c, context))) return { allowed: false, reason: "deny condition matched" };
  if (allow.length > 0) {
    const ok = allow.some((c) => evaluateCondition(c, context));
    return ok ? { allowed: true, reason: "allow condition matched" } : { allowed: false, reason: "no allow condition matched" };
  }
  return { allowed: defaultDecision === "allow", reason: `${defaultDecision} by default` };
}

function evaluateCondition(condition, context) {
  if (condition.all && condition.all.length > 0) return condition.all.every((c) => evaluateCondition(c, context));
  if (condition.any && condition.any.length > 0) return condition.any.some((c) => evaluateCondition(c, context));
  const value = getValue(context, condition.field);
  return compare(condition.op, value, condition.value);
}

function compare(op, left, right) {
  switch (op) {
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "gt":
      return Number(left) > Number(right);
    case "gte":
      return Number(left) >= Number(right);
    case "lt":
      return Number(left) < Number(right);
    case "lte":
      return Number(left) <= Number(right);
    case "includes":
      return Array.isArray(left) ? left.includes(right) : typeof left === "string" ? left.includes(String(right)) : false;
    case "excludes":
      return Array.isArray(left) ? !left.includes(right) : typeof left === "string" ? !left.includes(String(right)) : false;
    case "exists":
      return left !== undefined && left !== null;
    case "missing":
      return left === undefined || left === null;
    default:
      return false;
  }
}

function getValue(payload, path) {
  if (!path) return undefined;
  return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), payload);
}

function safeJson(raw) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    return raw;
  }
}

async function processAutomationQueue(client) {
  const actions = await fetchPendingActions(client);
  const stats = { processed: actions.length, succeeded: 0, failed: 0, skipped: 0 };
  for (const action of actions) {
    if ((action.attempt_count ?? 0) >= ACTION_MAX_ATTEMPTS) {
      await markActionStatus(client, action.id, "failed", "max attempts exceeded");
      stats.skipped += 1;
      logWarn("action max attempts exceeded", { actionId: action.id });
      continue;
    }
    await markActionStatus(client, action.id, "processing", null, true);
    try {
      const parsed = typeof action.action_payload === "string" ? JSON.parse(action.action_payload) : action.action_payload;
      const result = await withRetries(`action:${action.id}`, ACTION_MAX_RETRIES, () => handleAction({ ...action, action_payload: parsed }, client));
      if (result.ok) {
        await markActionStatus(client, action.id, "completed", null);
        stats.succeeded += 1;
      } else {
        await markActionStatus(client, action.id, "failed", result.error || "handler returned error");
        stats.failed += 1;
      }
    } catch (err) {
      await markActionStatus(client, action.id, "failed", err?.message || String(err));
      logError("action failed", { actionId: action.id, err: err?.message || String(err) });
      stats.failed += 1;
    }
  }
  return stats;
}

async function fetchQueuedReportJobs(client) {
  const { rows } = await client.query(
    `select * from report_jobs
     where status = 'queued' and attempt_count < $2
     order by created_at asc
     limit $1
     for update skip locked`,
    [REPORT_BATCH_SIZE, REPORT_MAX_ATTEMPTS]
  );
  return rows;
}

async function markReportStatus(client, id, status, output = {}, incrementAttempt = false) {
  await client.query(
    `update report_jobs
     set status = $1,
         output_location = $2,
         error = $3,
         started_at = coalesce(started_at, now()),
         completed_at = case when $1 in ('succeeded','failed') then now() else completed_at end,
         updated_at = now(),
         ${incrementAttempt ? "attempt_count = attempt_count + 1" : "attempt_count = attempt_count"}
     where id = $4`,
    [status, output.location || null, output.error || null, id]
  );
}

async function executeReportJob(job, client) {
  const { rows } = await client.query(`select name, report_type, definition from reports where id = $1 and tenant_slug = $2`, [job.report_id, job.tenant_slug]);
  if (!rows.length) return { ok: false, error: "report not found" };
  const report = rows[0];
  const payload = {
    reportId: job.report_id,
    name: report.name,
    type: report.report_type,
    filters: job.filters,
    definition: report.definition,
    generatedAt: new Date().toISOString(),
  };
  const upload = await uploadReportPayload(job, payload);
  if (!upload.ok) return upload;
  return { ok: true, location: upload.location };
}

async function processReportJobs(client) {
  const jobs = await fetchQueuedReportJobs(client);
  const stats = { processed: jobs.length, succeeded: 0, failed: 0, skipped: 0 };
  for (const job of jobs) {
    if ((job.attempt_count ?? 0) >= REPORT_MAX_ATTEMPTS) {
      await markReportStatus(client, job.id, "failed", { error: "max attempts exceeded" });
      stats.skipped += 1;
      logWarn("report max attempts exceeded", { reportJobId: job.id });
      continue;
    }
    await markReportStatus(client, job.id, "running", {}, true);
    try {
      const result = await withRetries(`report:${job.id}`, REPORT_MAX_RETRIES, () => executeReportJob(job, client));
      if (result.ok) {
        await markReportStatus(client, job.id, "succeeded", { location: result.location });
        stats.succeeded += 1;
      } else {
        await markReportStatus(client, job.id, "failed", { error: result.error || "report failed" });
        stats.failed += 1;
      }
    } catch (err) {
      await markReportStatus(client, job.id, "failed", { error: err?.message || String(err) });
      logError("report failed", { reportJobId: job.id, err: err?.message || String(err) });
      stats.failed += 1;
    }
  }
  return stats;
}

async function uploadReportPayload(job, payload) {
  const body = JSON.stringify(payload);
  const headers = REPORT_UPLOAD_HEADERS ? safeJson(REPORT_UPLOAD_HEADERS) : { "Content-Type": "application/json" };

  const targetUrl = REPORT_UPLOAD_BASE_URL
    ? `${REPORT_UPLOAD_BASE_URL.replace(/\/$/, "")}/${job.id}.json`
    : REPORT_UPLOAD_URL;

  if (!targetUrl) {
    const location = `data:application/json;base64,${Buffer.from(body).toString("base64")}`;
    return { ok: true, location };
  }

  const res = await fetch(targetUrl, {
    method: REPORT_UPLOAD_METHOD,
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });

  if (!res.ok) {
    return { ok: false, error: `upload failed ${res.status}` };
  }

  return { ok: true, location: targetUrl };
}

async function main() {
  await withClient(async (client) => {
    const actions = await processAutomationQueue(client);
    const reports = await processReportJobs(client);
    logInfo("worker run complete", { actions, reports });
    const failures = (actions.failed || 0) + (reports.failed || 0);
    const skipped = (actions.skipped || 0) + (reports.skipped || 0);
    const exitCode = failures > 0 ? 1 : 0;
    logInfo("worker summary", { failures, skipped, exitCode });
    process.exitCode = exitCode;
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
