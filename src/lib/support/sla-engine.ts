import { randomUUID } from "crypto";

import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { emitEvent } from "@/lib/notify";

export function ensureSlaEngine() {
  return ensureOnce("support/sla-engine:ensureTables", ensureSlaEngineRun);
}

async function ensureSlaEngineRun() {
  const sql = SQL;
  await sql`alter table if exists sla_policies add column if not exists service_days jsonb not null default '["mon","tue","wed","thu","fri"]'`;
  await sql`alter table if exists sla_policies add column if not exists business_start time not null default '08:00'`;
  await sql`alter table if exists sla_policies add column if not exists business_end time not null default '17:00'`;
  await sql`alter table if exists sla_policies add column if not exists pause_on_statuses text[] not null default '{}'`;
  await sql`alter table if exists sla_policies add column if not exists fulfil_on_statuses text[] not null default '{resolved,closed}'`;
  await sql`alter table if exists support_tickets add column if not exists sla_paused boolean not null default false`;
  await sql`alter table if exists support_tickets add column if not exists sla_paused_at timestamptz`;
  await sql`alter table if exists support_tickets add column if not exists sla_paused_total_minutes integer not null default 0`;
  await sql`alter table if exists support_tickets add column if not exists sla_breached boolean not null default false`;
  await sql`alter table if exists support_tickets add column if not exists sla_breach_type text`;
  await sql`create table if not exists support_warranty_claims (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    claim_number text not null,
    serial_no text,
    product_sku text,
    customer_id text,
    customer_name text,
    issue_date date not null default current_date,
    warranty_expiry date,
    status text not null default 'open'
      check (status in ('open','under_review','approved','rejected','work_done','closed')),
    complaint text not null,
    resolution text,
    ticket_id text,
    resolved_at timestamptz,
    created_by text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_slug, claim_number)
  )`;
}

// ---------------------------------------------------------------------------
// SLA policies — business-hours-aware deadlines
// ---------------------------------------------------------------------------

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function isServiceTime(date: Date, serviceDays: string[], start: string, end: string) {
  const day = DAY_KEYS[date.getUTCDay()];
  if (!serviceDays.includes(day)) return false;
  const hhmm = `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
  return hhmm >= start && hhmm < end;
}

/**
 * Advance `minutes` of SLA clock from `from`, counting only business hours
 * on service days (ERPNext service-level behavior).
 */
export function addServiceMinutes(from: Date, minutes: number, serviceDays: string[], start: string, end: string): Date {
  const cursor = new Date(from);
  let remaining = minutes;
  const dayStart = new Date(cursor); dayStart.setUTCHours(Number(start.split(":")[0]), Number(start.split(":")[1]), 0, 0);
  const dayEnd = new Date(cursor); dayEnd.setUTCHours(Number(end.split(":")[0]), Number(end.split(":")[1]), 0, 0);
  const dailyMinutes = (dayEnd.getTime() - dayStart.getTime()) / 60000;

  while (remaining > 0) {
    if (isServiceTime(cursor, serviceDays, start, end)) {
      const endToday = new Date(cursor); endToday.setUTCHours(Number(end.split(":")[0]), Number(end.split(":")[1]), 0, 0);
      const avail = Math.min(remaining, (endToday.getTime() - cursor.getTime()) / 60000);
      cursor.setTime(cursor.getTime() + avail * 60000);
      remaining -= avail;
    } else {
      // Jump to next service window
      cursor.setTime(cursor.getTime() + 60000);
      // skip non-service minutes in 1-min steps is slow for long gaps —
      // jump to next business start when outside hours
      if (remaining > dailyMinutes * 2) {
        const next = new Date(cursor);
        next.setUTCDate(next.getUTCDate() + 1);
        next.setUTCHours(Number(start.split(":")[0]), Number(start.split(":")[1]), 0, 0);
        if (!isServiceTime(cursor, serviceDays, start, end) && cursor < next) cursor.setTime(next.getTime());
      }
    }
    // safety: cap at 365 days out
    if (cursor.getTime() - from.getTime() > 365 * 24 * 60 * 60000) break;
  }
  return cursor;
}

export async function updateSlaPolicy(input: {
  tenantSlug: string;
  policyId: string;
  serviceDays?: string[];
  businessStart?: string;
  businessEnd?: string;
  pauseOnStatuses?: string[];
  fulfilOnStatuses?: string[];
}) {
  await ensureSlaEngine();
  await db.query(
    `UPDATE sla_policies SET
       service_days = coalesce($1, service_days),
       business_start = coalesce($2, business_start),
       business_end = coalesce($3, business_end),
       pause_on_statuses = coalesce($4, pause_on_statuses),
       fulfil_on_statuses = coalesce($5, fulfil_on_statuses),
       updated_at = now()
     WHERE id = $6 AND tenant_slug = $7`,
    [input.serviceDays ? JSON.stringify(input.serviceDays) : null,
     input.businessStart ?? null, input.businessEnd ?? null,
     input.pauseOnStatuses ?? null, input.fulfilOnStatuses ?? null,
     input.policyId, input.tenantSlug]);
}

/**
 * Recalculate a ticket's SLA deadlines using its policy's business calendar
 * — call when a policy's calendar changes or a ticket's clock must reset.
 */
export async function recalcTicketSla(tenantSlug: string, ticketId: string) {
  await ensureSlaEngine();
  const t = (await db.query(
    `SELECT t.*, p.service_days, p.business_start, p.business_end, p.response_minutes, p.resolution_minutes
     FROM support_tickets t JOIN sla_policies p ON p.id = t.sla_policy_id
     WHERE t.id = $1 AND t.tenant_slug = $2`,
    [ticketId, tenantSlug])).rows[0];
  if (!t) throw new Error("Ticket or SLA policy not found");
  const created = new Date(t.created_at);
  const serviceDays = Array.isArray(t.service_days) ? t.service_days : ["mon", "tue", "wed", "thu", "fri"];
  const responseDue = addServiceMinutes(created, Number(t.response_minutes), serviceDays, t.business_start, t.business_end);
  const resolutionDue = addServiceMinutes(created, Number(t.resolution_minutes), serviceDays, t.business_start, t.business_end);
  await db.query(
    `UPDATE support_tickets SET response_due_at = $1, resolution_due_at = $2 WHERE id = $3`,
    [responseDue.toISOString(), resolutionDue.toISOString(), ticketId]);
  return { responseDue, resolutionDue };
}

/**
 * Pause/resume the SLA clock on status change (ERPNext pause-on-status):
 * when a ticket enters a pause status we stop the clock; on exit we shift
 * the due dates forward by the paused duration.
 */
export async function applySlaStatusTransition(tenantSlug: string, ticketId: string, newStatus: string) {
  await ensureSlaEngine();
  const t = (await db.query(
    `SELECT t.*, p.pause_on_statuses, p.fulfil_on_statuses
     FROM support_tickets t LEFT JOIN sla_policies p ON p.id = t.sla_policy_id
     WHERE t.id = $1 AND t.tenant_slug = $2`,
    [ticketId, tenantSlug])).rows[0];
  if (!t?.sla_policy_id) return { slaApplied: false };

  const pauseStatuses: string[] = t.pause_on_statuses ?? [];
  const shouldPause = pauseStatuses.includes(newStatus);

  if (shouldPause && !t.sla_paused) {
    await db.query(
      `UPDATE support_tickets SET sla_paused = true, sla_paused_at = now() WHERE id = $1`, [ticketId]);
    return { slaApplied: true, action: "paused" };
  }
  if (!shouldPause && t.sla_paused && t.sla_paused_at) {
    const pausedMin = Math.max(0, (Date.now() - new Date(t.sla_paused_at).getTime()) / 60000);
    await db.query(
      `UPDATE support_tickets
       SET sla_paused = false, sla_paused_at = NULL,
           sla_paused_total_minutes = sla_paused_total_minutes + $1,
           response_due_at = response_due_at + ($1 || ' minutes')::interval,
           resolution_due_at = resolution_due_at + ($1 || ' minutes')::interval
       WHERE id = $2`,
      [Math.round(pausedMin), ticketId]);
    return { slaApplied: true, action: "resumed", pausedMinutes: Math.round(pausedMin) };
  }
  return { slaApplied: false };
}

/**
 * Scan open tickets for SLA breaches — marks sla_breached + type and
 * notifies the assigned engineer. Run on a schedule.
 */
export async function detectSlaBreaches(tenantSlug: string) {
  await ensureSlaEngine();
  const breached = (await db.query(
    `UPDATE support_tickets
     SET sla_breached = true,
         sla_breach_type = CASE
           WHEN first_response_at IS NULL AND response_due_at < now() THEN 'response'
           ELSE 'resolution' END
     WHERE tenant_slug = $1 AND NOT sla_breached
       AND status NOT IN ('resolved','closed','cancelled')
       AND (
         (first_response_at IS NULL AND response_due_at IS NOT NULL AND response_due_at < now())
         OR (resolution_due_at IS NOT NULL AND resolution_due_at < now())
       )
     RETURNING id, ticket_number, assigned_engineer_id, sla_breach_type`,
    [tenantSlug])).rows;

  for (const t of breached) {
    try {
      await emitEvent({
        tenantSlug,
        eventType: "sla_breach" as any,
        sourceModule: "support",
        sourceRecordId: t.id,
        payload: {
          ticketNumber: t.ticket_number,
          breachType: t.sla_breach_type,
          engineerId: t.assigned_engineer_id,
        },
        explicitSpecs: t.assigned_engineer_id
          ? [{ kind: "user", value: t.assigned_engineer_id }]
          : undefined,
      });
    } catch { /* notification infra optional */ }
  }
  return { breached: breached.length };
}

// ---------------------------------------------------------------------------
// Warranty claims
// ---------------------------------------------------------------------------

function nextClaimNumber() {
  return `WC-${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 4).toUpperCase()}`;
}

export async function createWarrantyClaim(input: {
  tenantSlug: string;
  serialNo?: string;
  productSku?: string;
  customerId?: string;
  customerName?: string;
  warrantyExpiry?: string;
  complaint: string;
  createdBy?: string;
}) {
  await ensureSlaEngine();
  return (await db.query(
    `INSERT INTO support_warranty_claims
       (tenant_slug, claim_number, serial_no, product_sku, customer_id, customer_name,
        warranty_expiry, complaint, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [input.tenantSlug, nextClaimNumber(), input.serialNo ?? null, input.productSku ?? null,
     input.customerId ?? null, input.customerName ?? null, input.warrantyExpiry ?? null,
     input.complaint, input.createdBy ?? null])).rows[0];
}

export async function listWarrantyClaims(tenantSlug: string, status?: string) {
  await ensureSlaEngine();
  return status
    ? (await db.query(`SELECT * FROM support_warranty_claims WHERE tenant_slug = $1 AND status = $2 ORDER BY created_at DESC`, [tenantSlug, status])).rows
    : (await db.query(`SELECT * FROM support_warranty_claims WHERE tenant_slug = $1 ORDER BY created_at DESC`, [tenantSlug])).rows;
}

export async function updateWarrantyClaim(input: {
  tenantSlug: string;
  claimId: string;
  status?: string;
  resolution?: string;
  ticketId?: string;
}) {
  await ensureSlaEngine();
  const row = (await db.query(
    `UPDATE support_warranty_claims
     SET status = coalesce($1, status),
         resolution = coalesce($2, resolution),
         ticket_id = coalesce($3, ticket_id),
         resolved_at = CASE WHEN $1 IN ('work_done','closed','rejected') THEN now() ELSE resolved_at END,
         updated_at = now()
     WHERE id = $4 AND tenant_slug = $5 RETURNING *`,
    [input.status ?? null, input.resolution ?? null, input.ticketId ?? null, input.claimId, input.tenantSlug])).rows[0];
  if (!row) throw new Error("Warranty claim not found");
  return row;
}
