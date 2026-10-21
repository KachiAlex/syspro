// Unified ERP notification pipeline.
//
//   action → emitEvent() → domain_events ──┐
//                                        ├→ notification_rules (+ defaults)
//                                        ├→ resolve recipients (role/user/party)
//                                        ├→ app_notifications (in-app, instant)
//                                        └→ notification_outbox (email, durable)
//                                                     ↓
//                                     drainNotificationOutbox() via /api/cron
//
// Emission is best-effort: failures are logged, never thrown, so notifications
// can never break the business action that produced them. Outbox rows are
// deduped by (tenant, dedupe_key, channel, recipient) so retries/double-emits
// are idempotent.

import { sql as SQL } from "@/lib/sql-client";
import { sendEmail } from "@/lib/email";
import { renderNotification } from "@/lib/notify/templates";

export type RecipientSpec =
  | { kind: "role"; value: string }
  | { kind: "user"; value: string }
  | { kind: "party" }
  | { kind: "emails"; value: string[] }
  | { kind: "admin" };

interface ResolvedRecipient {
  key: string; // tenant_admins.id / employee id / email — matches session userId
  email?: string;
  name?: string;
}

interface Rule {
  channels: string[];
  recipients: RecipientSpec[];
  enabled: boolean;
  subject_override?: string;
}

// Built-in routing used when the tenant has no notification_rules row for the
// event type. Tenants override per event via POST /api/notifications/rules.
const DEFAULT_RULES: Record<string, Rule> = {
  "approval.requested": { channels: ["email", "in_app"], recipients: [], enabled: true }, // explicit step approvers
  "approval.decided": { channels: ["email", "in_app"], recipients: [], enabled: true }, // requester
  "invoice.issued": {
    channels: ["email"], recipients: [{ kind: "party" }, { kind: "role", value: "finance_manager" }], enabled: true,
  },
  "payment.received": {
    channels: ["email", "in_app"], recipients: [{ kind: "party" }, { kind: "role", value: "finance_manager" }], enabled: true,
  },
  "dunning.issued": {
    channels: ["email"], recipients: [{ kind: "party" }, { kind: "role", value: "finance_manager" }], enabled: true,
  },
  "return.posted": { channels: ["email", "in_app"], recipients: [{ kind: "role", value: "finance_manager" }], enabled: true },
  "pos.shift_flagged": { channels: ["email", "in_app"], recipients: [{ kind: "admin" }], enabled: true },
  "leave.decided": { channels: ["email", "in_app"], recipients: [{ kind: "party" }], enabled: true },
  "payroll.run_posted": {
    channels: ["in_app"], recipients: [{ kind: "role", value: "finance_manager" }, { kind: "admin" }], enabled: true,
  },
  "payment_request.created": { channels: ["email"], recipients: [{ kind: "party" }], enabled: true },
  "payment_link.created": { channels: ["email"], recipients: [{ kind: "party" }], enabled: true },
  "expense.decided": { channels: ["email", "in_app"], recipients: [{ kind: "party" }], enabled: true },
  "budget.breached": {
    channels: ["email", "in_app"], recipients: [{ kind: "role", value: "finance_manager" }], enabled: true,
  },
  "customer.credit_hold": {
    channels: ["email", "in_app"], recipients: [{ kind: "role", value: "finance_manager" }, { kind: "admin" }], enabled: true,
  },
  "po.created": { channels: ["in_app"], recipients: [{ kind: "role", value: "finance_manager" }], enabled: true },
  "bill.created": { channels: ["in_app"], recipients: [{ kind: "role", value: "finance_manager" }], enabled: true },
  "vendor_payment.made": {
    channels: ["email"], recipients: [{ kind: "party" }, { kind: "role", value: "finance_manager" }], enabled: true,
  },
  "leave.requested": {
    channels: ["email", "in_app"], recipients: [{ kind: "admin" }], enabled: true, // + reporting manager via explicitSpecs
  },
  "wo.completed": { channels: ["in_app"], recipients: [{ kind: "admin" }], enabled: true },
  "qc.failed": {
    channels: ["email", "in_app"], recipients: [{ kind: "admin" }, { kind: "role", value: "production_manager" }], enabled: true,
  },
  "stock.low": {
    channels: ["email", "in_app"], recipients: [{ kind: "admin" }, { kind: "role", value: "inventory_manager" }], enabled: true,
  },
};

let ensured = false;
export async function ensureNotifyTables() {
  if (ensured) return;
  const sql = SQL;
  await sql`create table if not exists domain_events (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    event_type text not null,
    source_module text,
    source_record_id text,
    actor_id text,
    payload jsonb,
    created_at timestamptz not null default now()
  )`;
  await sql`create index if not exists domain_events_tenant_idx
    on domain_events(tenant_slug, event_type, created_at desc)`;
  await sql`create table if not exists notification_rules (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    event_type text not null,
    channels jsonb not null default '["email"]',
    recipients jsonb not null default '[]',
    enabled boolean not null default true,
    subject_override text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(tenant_slug, event_type)
  )`;
  await sql`create table if not exists notification_outbox (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    dedupe_key text not null,
    channel text not null default 'email',
    event_type text not null,
    recipient text not null,
    recipient_name text,
    subject text,
    body_html text,
    body_text text,
    link text,
    status text not null default 'pending',
    attempts int not null default 0,
    next_retry_at timestamptz not null default now(),
    last_error text,
    sent_at timestamptz,
    created_at timestamptz not null default now(),
    unique(tenant_slug, dedupe_key, channel, recipient)
  )`;
  await sql`create index if not exists notification_outbox_pending_idx
    on notification_outbox(next_retry_at) where status = 'pending'`;
  await sql`create table if not exists app_notifications (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    user_id text not null,
    event_type text not null,
    title text not null,
    body text,
    link text,
    read_at timestamptz,
    created_at timestamptz not null default now()
  )`;
  await sql`create index if not exists app_notifications_user_idx
    on app_notifications(tenant_slug, user_id, read_at, created_at desc)`;
  // Shares the row used by /api/user/notifications/preferences — prefs live
  // in the jsonb blob so both APIs read/write the same document.
  await sql`create table if not exists user_notification_preferences (
    user_id text primary key,
    tenant_slug text,
    preferences jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
  )`;
  ensured = true;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  frequency: "immediate" | "daily";
  quietStart?: string | null; // "HH:MM"
  quietEnd?: string | null;
  quietTz?: string | null;
}

const DEFAULT_PREFS: NotificationPreferences = {
  emailEnabled: true,
  inAppEnabled: true,
  frequency: "immediate",
};

// Maps the shared jsonb blob ({email, inApp, frequency, quietHours, ...}) onto
// the pipeline's shape. Unknown keys (categories, push) are preserved on save.
function prefsFromJson(raw: any): NotificationPreferences {
  const p = typeof raw === "string" ? JSON.parse(raw || "{}") : (raw ?? {});
  const qh = p.quietHours ?? {};
  const quietOn = qh.enabled === true;
  return {
    emailEnabled: p.email !== false,
    inAppEnabled: p.inApp !== false,
    frequency: p.frequency === "daily" ? "daily" : "immediate",
    quietStart: quietOn ? qh.start ?? null : null,
    quietEnd: quietOn ? qh.end ?? null : null,
    quietTz: quietOn ? qh.timezone ?? null : null,
  };
}

async function getPrefsFor(tenantSlug: string, userKeys: string[]): Promise<Map<string, NotificationPreferences>> {
  const sql = SQL;
  const rows = (await sql`select user_id, preferences
    from user_notification_preferences where user_id = ANY(${userKeys})`) as any[];
  const map = new Map<string, NotificationPreferences>();
  for (const r of rows) {
    try { map.set(r.user_id, prefsFromJson(r.preferences)); } catch { /* malformed prefs → defaults */ }
  }
  return map;
}

export async function getNotificationPreferences(tenantSlug: string, userId: string): Promise<NotificationPreferences> {
  const sql = SQL;
  await ensureNotifyTables();
  const map = await getPrefsFor(tenantSlug, [userId]);
  return map.get(userId) ?? DEFAULT_PREFS;
}

export async function saveNotificationPreferences(input: {
  tenantSlug: string;
  userId: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  frequency: "immediate" | "daily";
  quietStart?: string | null;
  quietEnd?: string | null;
  quietTz?: string | null;
}) {
  const sql = SQL;
  await ensureNotifyTables();
  // Merge into the existing jsonb so keys owned by the other preferences API
  // (categories, push) are preserved.
  const [existing] = (await sql`select preferences from user_notification_preferences
    where user_id = ${input.userId} limit 1`) as any[];
  const current = existing
    ? (typeof existing.preferences === "string" ? JSON.parse(existing.preferences) : existing.preferences ?? {})
    : {};
  const quietEnabled = !!(input.quietStart && input.quietEnd && input.quietTz);
  const merged = {
    ...current,
    email: input.emailEnabled,
    inApp: input.inAppEnabled,
    frequency: input.frequency,
    quietHours: {
      ...(current.quietHours ?? {}),
      enabled: quietEnabled,
      ...(quietEnabled
        ? { start: input.quietStart, end: input.quietEnd, timezone: input.quietTz }
        : {}),
    },
  };
  await sql`insert into user_notification_preferences (user_id, tenant_slug, preferences, updated_at)
    values (${input.userId}, ${input.tenantSlug}, ${JSON.stringify(merged)}, now())
    on conflict (user_id) do update set
      preferences = ${JSON.stringify(merged)}::jsonb,
      tenant_slug = coalesce(user_notification_preferences.tenant_slug, excluded.tenant_slug),
      updated_at = now()`;
}

// Returns the instant the user's quiet window ends, or null if they aren't in
// one right now. Quiet hours defer email sends — in-app rows still land.
function quietDeferUntil(pref: NotificationPreferences): string | null {
  if (!pref.quietStart || !pref.quietEnd || !pref.quietTz) return null;
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: pref.quietTz, hour: "2-digit", minute: "2-digit",
      hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const hhmm = `${get("hour")}:${get("minute")}`;
    const start = pref.quietStart, end = pref.quietEnd;
    const inWindow = start <= end
      ? hhmm >= start && hhmm < end
      : hhmm >= start || hhmm < end; // overnight window
    if (!inWindow) return null;
    // Resolve quiet end in the user's tz → absolute time
    const endDateStr = hhmm < end
      ? `${get("year")}-${get("month")}-${get("day")}`
      : new Date(now.getTime() + 86400000).toISOString().slice(0, 10); // next day
    const approx = new Date(`${endDateStr}T${end}:00`);
    // Shift from user tz to UTC: build the same wall time, then offset by the
    // tz offset of the approx instant (close enough for notification deferral)
    const offsetMin = tzOffsetMinutes(pref.quietTz, approx);
    return new Date(approx.getTime() - offsetMin * 60000).toISOString();
  } catch {
    return null;
  }
}

function tzOffsetMinutes(tz: string, at: Date): number {
  const s = at.toLocaleString("en-US", { timeZone: "UTC" });
  const t = at.toLocaleString("en-US", { timeZone: tz });
  return Math.round((new Date(t).getTime() - new Date(s).getTime()) / 60000);
}

// Daily digests go out in the first drain after 08:00 UTC.
function nextDigestTime(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 0, 0));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

// Best-effort party-email resolution when the payload doesn't carry one.
// Sources: the invoice row itself → the finance_customers record → the CRM
// customer's contact email (matched on company/customer name).
async function resolvePartyEmail(tenantSlug: string, payload: Record<string, any>): Promise<string | null> {
  const sql = SQL;
  const direct = payload.partyEmail ?? payload.email;
  if (typeof direct === "string" && direct.includes("@")) return direct;

  const invoiceId = payload.invoiceId;
  if (invoiceId) {
    const [inv] = (await sql`select customer_email from finance_invoices
      where id = ${invoiceId} and tenant_slug = ${tenantSlug} limit 1`) as any[];
    if (inv?.customer_email) return inv.customer_email;
  }

  const customerId = payload.customerId;
  const customerCode = payload.customerCode;
  if (customerId || customerCode) {
    const [cust] = (await sql`select email from finance_customers
      where tenant_slug = ${tenantSlug}
        and ((${customerId ?? null}::text is not null and id::text = ${customerId ?? null})
          or (${customerCode ?? null}::text is not null and customer_code = ${customerCode ?? null}))
      limit 1`) as any[];
    if (cust?.email) return cust.email;
  }

  const name = payload.customerName ?? payload.partyName;
  if (name) {
    const [crm] = (await sql`select primary_contact->>'email' as contact_email from crm_customers
      where tenant_slug = ${tenantSlug} and primary_contact->>'email' is not null
        and lower(trim(name)) = lower(trim(${name}))
      limit 1`) as any[];
    if (crm?.contact_email) return crm.contact_email;
  }
  return null;
}

async function resolveRecipients(tenantSlug: string, specs: RecipientSpec[], payload: Record<string, any>): Promise<ResolvedRecipient[]> {
  const sql = SQL;
  const out = new Map<string, ResolvedRecipient>();

  const adminRows = async (where: "all" | string) => {
    if (where === "all") {
      return (await sql`select id::text as id, email, name, role from tenant_admins where tenant_slug = ${tenantSlug}`) as any[];
    }
    return (await sql`select id::text as id, email, name, role from tenant_admins where tenant_slug = ${tenantSlug} and role = ${where}`) as any[];
  };

  for (const spec of specs) {
    if (spec.kind === "role") {
      let rows = await adminRows(spec.value);
      if (!rows.length) rows = await adminRows("all"); // role unfilled → admins get it so nothing is lost
      for (const r of rows) out.set(r.id, { key: r.id, email: r.email, name: r.name });
    } else if (spec.kind === "admin") {
      for (const r of await adminRows("all")) out.set(r.id, { key: r.id, email: r.email, name: r.name });
    } else if (spec.kind === "user") {
      // Callers pass ids in several shapes: raw id, "admin:{id}", "emp:{id}",
      // or a bare email.
      const bare = spec.value.includes(":") ? spec.value.slice(spec.value.lastIndexOf(":") + 1) : spec.value;
      const [admin] = (await sql`select id::text as id, email, name from tenant_admins where tenant_slug = ${tenantSlug} and (id::text = ${bare} or email = ${spec.value} or email = ${bare}) limit 1`) as any[];
      if (admin) {
        out.set(admin.id, { key: admin.id, email: admin.email, name: admin.name });
      } else {
        const [emp] = (await sql`select id::text as id, email, name from admin_employees where tenant_slug = ${tenantSlug} and (id::text = ${bare} or email = ${spec.value} or email = ${bare}) limit 1`) as any[];
        if (emp) out.set(emp.id, { key: emp.id, email: emp.email, name: emp.name });
        else if (spec.value.includes("@")) out.set(spec.value, { key: spec.value, email: spec.value });
      }
    } else if (spec.kind === "emails") {
      for (const email of spec.value) if (email) out.set(email, { key: email, email });
    } else if (spec.kind === "party") {
      const email = await resolvePartyEmail(tenantSlug, payload);
      if (email) out.set(email, { key: email, email, name: payload.partyName ?? payload.customerName });
    }
  }
  return [...out.values()];
}

export interface EmitEventInput {
  tenantSlug: string;
  eventType: string;
  sourceModule?: string;
  sourceRecordId?: string;
  actorId?: string;
  actorEmail?: string;
  payload?: Record<string, any>;
  /** Recipient overrides (e.g. resolved approval-step approvers). Bypasses the rule's recipient specs. */
  explicitRecipients?: { id?: string; email?: string; name?: string }[];
  /** Recipient-spec overrides — resolved through the normal role/user/party path. */
  explicitSpecs?: RecipientSpec[];
  /** Fixed dedupe suffix — set for deterministic events like generated dunning notices. */
  dedupeKey?: string;
}

export async function emitEvent(input: EmitEventInput): Promise<void> {
  try {
    const sql = SQL;
    await ensureNotifyTables();

    await sql`insert into domain_events (tenant_slug, event_type, source_module, source_record_id, actor_id, payload)
      values (${input.tenantSlug}, ${input.eventType}, ${input.sourceModule ?? null}, ${input.sourceRecordId ?? null},
        ${input.actorId ?? null}, ${JSON.stringify(input.payload ?? {})})`;

    // Tenant rule override → fall back to defaults
    const [ruleRow] = (await sql`select channels, recipients, enabled, subject_override from notification_rules
      where tenant_slug = ${input.tenantSlug} and event_type = ${input.eventType} limit 1`) as any[];
    const rule: Rule = ruleRow
      ? { channels: ruleRow.channels ?? [], recipients: ruleRow.recipients ?? [], enabled: ruleRow.enabled, subject_override: ruleRow.subject_override }
      : DEFAULT_RULES[input.eventType] ?? { channels: ["in_app"], recipients: [{ kind: "admin" }], enabled: true };
    if (!rule.enabled) return;

    const payload = input.payload ?? {};
    let recipients = input.explicitRecipients?.length
      ? input.explicitRecipients.map((r) => ({ key: r.id ?? r.email ?? "", email: r.email, name: r.name })).filter((r) => r.key)
      : input.explicitSpecs?.length
        ? await resolveRecipients(input.tenantSlug, input.explicitSpecs, payload)
        : await resolveRecipients(input.tenantSlug, rule.recipients, payload);

    // The actor should not be notified about their own action
    recipients = recipients.filter((r) =>
      r.key !== input.actorId && r.key !== input.actorEmail && r.email !== input.actorEmail
    );
    if (!recipients.length) return;

    const rendered = renderNotification(input.eventType, payload);
    const subject = rule.subject_override ?? rendered.subject;
    const dedupe = input.dedupeKey ?? crypto.randomUUID();

    // Per-user preferences: channel opt-outs, daily digest, quiet hours.
    const prefKeys = recipients.flatMap((r) => [r.key, r.email ?? ""].filter(Boolean));
    const prefs = await getPrefsFor(input.tenantSlug, prefKeys);
    const prefFor = (r: ResolvedRecipient) =>
      prefs.get(r.key) ?? (r.email ? prefs.get(r.email) : undefined) ?? DEFAULT_PREFS;

    for (const channel of rule.channels) {
      for (const r of recipients) {
        const pref = prefFor(r);
        if (channel === "email") {
          if (!r.email || !pref.emailEnabled) continue;
          // daily → held for the next 08:00 UTC digest pass; immediate → next drain
          const status = pref.frequency === "daily" ? "held" : "pending";
          const deferUntil = status === "held" ? nextDigestTime() : quietDeferUntil(pref);
          await sql`insert into notification_outbox
              (tenant_slug, dedupe_key, channel, event_type, recipient, recipient_name,
               subject, body_html, body_text, link, status, next_retry_at)
            values (${input.tenantSlug}, ${dedupe}, 'email', ${input.eventType}, ${r.email},
              ${r.name ?? null}, ${subject}, ${rendered.html}, ${rendered.text}, ${rendered.link ?? null},
              ${status}, ${deferUntil ?? new Date().toISOString()})
            on conflict (tenant_slug, dedupe_key, channel, recipient) do nothing`;
        } else if (channel === "in_app") {
          // Only resolvable ERP users have a bell — party emails get email-only
          if (r.key.includes("@") || !pref.inAppEnabled) continue;
          const notifKey = `${dedupe}:app:${r.key}`;
          const inserted = (await sql`insert into notification_outbox
              (tenant_slug, dedupe_key, channel, event_type, recipient, recipient_name, subject, body_text, link)
            values (${input.tenantSlug}, ${notifKey}, 'in_app', ${input.eventType}, ${r.key},
              ${r.name ?? null}, ${subject}, ${rendered.text}, ${rendered.link ?? null})
            on conflict (tenant_slug, dedupe_key, channel, recipient) do nothing
            returning id`) as any[];
          // In-app lands instantly — it is the durable record itself. The
          // outbox row is the dedupe guard: only insert when it was new.
          if (inserted.length) {
            await sql`insert into app_notifications (tenant_slug, user_id, event_type, title, body, link)
              values (${input.tenantSlug}, ${r.key}, ${input.eventType}, ${subject}, ${rendered.text}, ${rendered.link ?? null})`;
          }
        }
      }
    }
  } catch (err) {
    console.error(`[notify] emit ${input.eventType} failed for ${input.tenantSlug}:`, err);
  }
}

const MAX_ATTEMPTS = 5;

/** Drains pending outbox rows. Returns processed/failed counts for cron reporting. */
export async function drainNotificationOutbox(batchSize = 50): Promise<{ sent: number; failed: number; retried: number }> {
  const sql = SQL;
  await ensureNotifyTables();
  // Recover rows a crashed worker left claimed: claims bump next_retry_at to
  // now+10m, so a 'sending' row past its own claim deadline is abandoned work.
  await sql`update notification_outbox set status = 'pending'
    where status = 'sending' and next_retry_at <= now()`;
  const rows = (await sql`select id, tenant_slug, recipient, recipient_name, subject, body_html, body_text, link, attempts
    from notification_outbox
    where status = 'pending' and channel = 'email' and next_retry_at <= now()
    order by next_retry_at asc
    limit ${batchSize}`) as any[];

  let sent = 0, failed = 0, retried = 0;
  for (const row of rows) {
    // Claim optimistically — a concurrent drainer gets 0 rows and skips. The
    // claim carries its own 10-minute lease via next_retry_at for crash recovery.
    const claimed = (await sql`update notification_outbox set status = 'sending',
        next_retry_at = now() + interval '10 minutes'
      where id = ${row.id} and status = 'pending' returning id`) as any[];
    if (!claimed.length) continue;

    const result = await sendEmail({ to: row.recipient, subject: row.subject, html: row.body_html, text: row.body_text });
    if (result.success) {
      sent++;
      await sql`update notification_outbox set status = 'sent', sent_at = now(), attempts = attempts + 1 where id = ${row.id}`;
    } else {
      const attempts = row.attempts + 1;
      const exhausted = attempts >= MAX_ATTEMPTS;
      // Exponential-ish backoff: 5, 10, 20, 40 min then dead
      const nextAt = new Date(Date.now() + 5 * Math.pow(2, attempts - 1) * 60_000);
      if (exhausted) failed++; else retried++;
      await sql`update notification_outbox set status = ${exhausted ? "dead" : "pending"},
          attempts = ${attempts}, next_retry_at = ${nextAt.toISOString()}, last_error = ${result.error ?? "send failed"}
        where id = ${row.id}`;
    }
  }

  // Daily-digest pass: held rows due now are collapsed into one email per
  // recipient instead of a batch of individual sends.
  const held = (await sql`select id, recipient, recipient_name, subject, body_text, link
    from notification_outbox
    where status = 'held' and channel = 'email' and next_retry_at <= now()
    order by created_at asc limit ${batchSize * 4}`) as any[];
  const byRecipient = new Map<string, any[]>();
  for (const h of held) {
    const list = byRecipient.get(h.recipient) ?? [];
    list.push(h);
    byRecipient.set(h.recipient, list);
  }
  for (const [recipient, items] of byRecipient) {
    const first = items[0];
    const subject = `${items.length} notification${items.length === 1 ? "" : "s"} — daily digest`;
    const bullets = items.map((i) => `<li style="margin:8px 0;color:#475569;">${i.subject}${i.link ? ` — <a href="${i.link}">view</a>` : ""}</li>`).join("");
    const html = `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <h2 style="color:#1e293b;">Daily notification digest</h2><ul>${bullets}</ul>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
      <p style="color:#94a3b8;font-size:12px;">Pisairtel ERP — automated digest, please do not reply.</p></div>`;
    const text = `Daily digest (${items.length})\n\n${items.map((i) => `• ${i.subject}`).join("\n")}`;
    const result = await sendEmail({ to: recipient, subject, html, text });
    for (const item of items) {
      await sql`update notification_outbox set status = ${result.success ? "sent" : "pending"},
          sent_at = ${result.success ? new Date().toISOString() : null}::timestamptz,
          attempts = attempts + 1, last_error = ${result.success ? null : result.error ?? "digest send failed"},
          next_retry_at = ${result.success ? new Date().toISOString() : nextDigestTime()}
        where id = ${item.id}`;
    }
    if (result.success) sent += 1; else retried += 1;
  }
  return { sent, failed, retried };
}

export async function listNotificationRules(tenantSlug: string) {
  const sql = SQL;
  await ensureNotifyTables();
  const rows = (await sql`select event_type, channels, recipients, enabled, subject_override from notification_rules
    where tenant_slug = ${tenantSlug} order by event_type`) as any[];
  // Merge tenant overrides over defaults so admins see the effective ruleset
  const merged = Object.entries(DEFAULT_RULES).map(([type, rule]) => ({
    eventType: type,
    channels: rule.channels,
    recipients: rule.recipients,
    enabled: rule.enabled,
    source: "default",
  }));
  const byType = new Map(rows.map((r) => [r.event_type, r]));
  return merged.map((m) => {
    const o = byType.get(m.eventType);
    return o ? { ...m, channels: o.channels, recipients: o.recipients, enabled: o.enabled, subjectOverride: o.subject_override, source: "tenant" } : m;
  });
}

export async function upsertNotificationRule(input: {
  tenantSlug: string;
  eventType: string;
  channels: string[];
  recipients: RecipientSpec[];
  enabled: boolean;
  subjectOverride?: string;
}) {
  const sql = SQL;
  await ensureNotifyTables();
  const [row] = (await sql`insert into notification_rules (tenant_slug, event_type, channels, recipients, enabled, subject_override)
    values (${input.tenantSlug}, ${input.eventType}, ${JSON.stringify(input.channels)}, ${JSON.stringify(input.recipients)},
      ${input.enabled}, ${input.subjectOverride ?? null})
    on conflict (tenant_slug, event_type)
    do update set channels = excluded.channels, recipients = excluded.recipients,
      enabled = excluded.enabled, subject_override = excluded.subject_override, updated_at = now()
    returning *`) as any[];
  return row;
}

export async function listAppNotifications(tenantSlug: string, userKeys: string[], limit = 25) {
  const sql = SQL;
  await ensureNotifyTables();
  return (await sql`select id, event_type, title, body, link, read_at, created_at
    from app_notifications
    where tenant_slug = ${tenantSlug} and user_id = ANY(${userKeys})
    order by created_at desc
    limit ${limit}`) as any[];
}

export async function countUnreadAppNotifications(tenantSlug: string, userKeys: string[]): Promise<number> {
  const sql = SQL;
  await ensureNotifyTables();
  const [r] = (await sql`select count(*)::int as n from app_notifications
    where tenant_slug = ${tenantSlug} and user_id = ANY(${userKeys}) and read_at is null`) as any[];
  return r?.n ?? 0;
}

export async function markAppNotificationsRead(tenantSlug: string, userKeys: string[], ids?: string[]) {
  const sql = SQL;
  await ensureNotifyTables();
  if (ids?.length) {
    await sql`update app_notifications set read_at = now()
      where tenant_slug = ${tenantSlug} and user_id = ANY(${userKeys}) and id::text = ANY(${ids})`;
  } else {
    await sql`update app_notifications set read_at = now()
      where tenant_slug = ${tenantSlug} and user_id = ANY(${userKeys}) and read_at is null`;
  }
}
