import { createHmac, randomUUID } from "crypto";

import { db } from "@/lib/sql-client";
import { webhookUrlAllowed } from "@/lib/automation/connectors";

// Outbound doc-event webhook subscriptions with HMAC signing + retry queue.
// Distinct from the automation-rules webhook connector: this fires on
// create/update/submit document lifecycle events regardless of rule config.

export async function listSubscriptions(tenantSlug: string) {
  return (await db.query<any>(
    `select id, name, target_url, doc_types, events, is_active, max_retries, created_at
     from webhook_subscriptions where tenant_slug = $1 order by name`,
    [tenantSlug]
  )).rows;
}

export async function createSubscription(input: {
  tenantSlug: string;
  name: string;
  targetUrl: string;
  secret?: string;
  docTypes: string[];
  events?: string[];
}) {
  const check = webhookUrlAllowed(input.targetUrl);
  if (!check.ok)
    throw new Error(`Target URL is not permitted: ${check.reason}`);
  return (await db.query<any>(
    `insert into webhook_subscriptions (tenant_slug, name, target_url, secret,
       doc_types, events)
     values ($1,$2,$3,$4,$5,$6) returning id, name, target_url, doc_types, events`,
    [input.tenantSlug, input.name, input.targetUrl, input.secret ?? null,
     input.docTypes, input.events ?? ["create", "update", "submit"]]
  )).rows[0];
}

export async function updateSubscription(input: {
  tenantSlug: string; id: string; isActive?: boolean; targetUrl?: string;
  secret?: string; docTypes?: string[]; events?: string[];
}) {
  if (input.targetUrl) {
    const check = webhookUrlAllowed(input.targetUrl);
    if (!check.ok)
      throw new Error(`Target URL is not permitted: ${check.reason}`);
  }
  return (await db.query<any>(
    `update webhook_subscriptions set
       is_active = coalesce($3, is_active),
       target_url = coalesce($4, target_url),
       secret = coalesce($5, secret),
       doc_types = coalesce($6, doc_types),
       events = coalesce($7, events)
     where id = $1 and tenant_slug = $2 returning id`,
    [input.id, input.tenantSlug, input.isActive ?? null, input.targetUrl ?? null,
     input.secret ?? null, input.docTypes ?? null, input.events ?? null]
  )).rows[0];
}

/**
 * Call after a document lifecycle event. Queues a delivery row per matching
 * subscription; actual HTTP dispatch is done by processDeliveries (also called
 * inline best-effort for low latency).
 */
export async function dispatchDocEvent(input: {
  tenantSlug: string;
  docType: string;
  docId: string;
  event: "create" | "update" | "submit" | "cancel";
  doc: Record<string, any>;
}) {
  const subs = (await db.query<any>(
    `select * from webhook_subscriptions
     where tenant_slug = $1 and is_active
       and (doc_types = '{}' or $2 = any(doc_types))
       and $3 = any(events)`,
    [input.tenantSlug, input.docType, input.event]
  )).rows;
  const payload = {
    event: input.event,
    docType: input.docType,
    docId: input.docId,
    tenant: input.tenantSlug,
    timestamp: new Date().toISOString(),
    data: input.doc,
  };
  for (const sub of subs) {
    await db.query(
      `insert into webhook_deliveries (subscription_id, tenant_slug, event,
         doc_type, doc_id, payload)
       values ($1,$2,$3,$4,$5,$6)`,
      [sub.id, input.tenantSlug, input.event, input.docType, input.docId,
       JSON.stringify(payload)]
    );
  }
  return { queued: subs.length };
}

async function deliver(delivery: any, sub: any) {
  const body = JSON.stringify(delivery.payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-ERP-Event": delivery.event,
    "X-ERP-Delivery": delivery.id,
  };
  if (sub.secret) {
    headers["X-ERP-Signature"] =
      "sha256=" + createHmac("sha256", sub.secret).update(body).digest("hex");
  }
  const res = await fetch(sub.target_url, {
    method: "POST", headers, body,
    signal: AbortSignal.timeout(10_000),
  });
  return res.status;
}

/** Process pending retries (call from a scheduler/cron route). */
export async function processDeliveries(limit = 25) {
  const rows = (await db.query<any>(
    `select d.*, s.target_url, s.secret, s.max_retries
     from webhook_deliveries d
     join webhook_subscriptions s on s.id = d.subscription_id
     where d.status = 'pending' and d.next_retry_at <= now()
     order by d.next_retry_at limit $1`,
    [limit]
  )).rows;
  let delivered = 0, failed = 0;
  for (const d of rows) {
    try {
      const code = await deliver(d, d);
      if (code >= 200 && code < 300) {
        await db.query(
          `update webhook_deliveries set status='delivered', attempts=attempts+1,
             response_code=$1, delivered_at=now() where id=$2`,
          [code, d.id]
        );
        delivered++;
      } else {
        throw new Error(`HTTP ${code}`);
      }
    } catch (err) {
      const attempts = d.attempts + 1;
      const dead = attempts >= (d.max_retries ?? 3);
      const backoffMin = Math.pow(2, attempts) * 5;
      await db.query(
        `update webhook_deliveries set attempts=$1, last_error=$2,
           status=$3, next_retry_at = now() + interval '1 minute' * $4
         where id=$5`,
        [attempts, err instanceof Error ? err.message : String(err),
         dead ? "dead" : "pending", backoffMin, d.id]
      );
      failed++;
    }
  }
  return { processed: rows.length, delivered, failed };
}

export async function listDeliveries(tenantSlug: string, status?: string, limit = 50) {
  return (await db.query<any>(
    `select id, subscription_id, event, doc_type, doc_id, status, attempts,
       response_code, last_error, created_at, delivered_at
     from webhook_deliveries where tenant_slug = $1
     ${status ? "and status = $3" : ""}
     order by created_at desc limit $2`,
    status ? [tenantSlug, limit, status] : [tenantSlug, limit]
  )).rows;
}

export async function retryDelivery(tenantSlug: string, id: string) {
  await db.query(
    `update webhook_deliveries set status='pending', next_retry_at=now()
     where id = $1 and tenant_slug = $2 and status in ('failed','dead')`,
    [id, tenantSlug]
  );
}

export function newDeliveryId() {
  return randomUUID();
}

// ---------------------------------------------------------------------------
// admin_integrations <-> webhook_subscriptions bridge
//
// The Integrations page stores a provider record (name, credentials, events)
// per tenant. A linked webhook_subscriptions row — keyed by integration_id —
// gives every integration with a webhook_url real delivery through the signed,
// retried pipeline above, instead of being a passive registry entry.
// ---------------------------------------------------------------------------

let linkColumnEnsured = false;
async function ensureIntegrationLinkColumn() {
  if (linkColumnEnsured) return;
  await db.query(
    `alter table webhook_subscriptions add column if not exists integration_id text`,
    []
  );
  await db.query(
    `create unique index if not exists webhook_subscriptions_integration_uidx
     on webhook_subscriptions (integration_id) where integration_id is not null`,
    []
  );
  linkColumnEnsured = true;
}

const DEFAULT_INTEGRATION_EVENTS = ["create", "update", "submit", "cancel"];

/**
 * Upsert the webhook subscription backing an integration record. Called after
 * integration create/update; pass the *unmasked* config so the real signing
 * secret is used. Throws when the target URL is not permitted.
 */
export async function syncIntegrationSubscription(integration: {
  id: string;
  tenantSlug: string;
  name: string;
  status: string;
  webhookUrl?: string | null;
  config?: Record<string, any> | null;
  events?: string[] | null;
}) {
  await ensureIntegrationLinkColumn();
  const cfg = integration.config ?? {};
  const targetUrl = integration.webhookUrl || null;

  // No webhook URL — the integration receives nothing; drop any link.
  if (!targetUrl) {
    await db.query(`delete from webhook_subscriptions where integration_id = $1`, [integration.id]);
    return { linked: false };
  }

  const check = webhookUrlAllowed(targetUrl);
  if (!check.ok) throw new Error(`Target URL is not permitted: ${check.reason}`);

  const docTypes = Array.isArray(cfg.docTypes) ? cfg.docTypes.map(String) : [];
  const events =
    Array.isArray(integration.events) && integration.events.length
      ? integration.events
      : DEFAULT_INTEGRATION_EVENTS;
  const secret =
    typeof cfg.webhookSecret === "string" && cfg.webhookSecret
      ? cfg.webhookSecret
      : typeof cfg.secret === "string" && cfg.secret
        ? cfg.secret
        : null;
  const active = integration.status === "active";
  const name = `Integration: ${integration.name}`;

  const existing = (
    await db.query<any>(
      `select id from webhook_subscriptions where integration_id = $1`,
      [integration.id]
    )
  ).rows[0];

  if (existing) {
    await db.query(
      `update webhook_subscriptions
       set name = $2, target_url = $3, secret = $4, doc_types = $5,
           events = $6, is_active = $7
       where id = $1`,
      [existing.id, name, targetUrl, secret, docTypes, events, active]
    );
  } else {
    await db.query(
      `insert into webhook_subscriptions
         (tenant_slug, name, target_url, secret, doc_types, events, is_active, integration_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [integration.tenantSlug, name, targetUrl, secret, docTypes, events, active, integration.id]
    );
  }
  return { linked: true, active };
}

/** Drop the linked subscription when the integration is deleted. */
export async function removeIntegrationSubscription(integrationId: string) {
  await ensureIntegrationLinkColumn();
  await db.query(`delete from webhook_subscriptions where integration_id = $1`, [integrationId]);
}
