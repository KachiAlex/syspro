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
