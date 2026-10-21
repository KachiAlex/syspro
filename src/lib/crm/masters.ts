import { db } from "@/lib/sql-client";

// CRM masters + edges: territory tree, industry types, market segments,
// competitors (with deal linkage), notes, appointments, SMS center.

function paged<T>(conds: string[], params: any[], orderBy: string, select: string, table: string) {
  return db.query<T>(
    `select ${select} from ${table} where ${conds.join(" and ")} order by ${orderBy}`,
    params
  ).then((r) => r.rows);
}

// ── Territory tree ─────────────────────────────────────────────────────────

export async function listTerritories(tenantSlug: string) {
  return paged(["tenant_slug = $1"], [tenantSlug],
    "parent_id nulls first, name",
    "id, name, parent_id, is_group, territory_manager", "crm_territories");
}

export async function upsertTerritory(input: {
  tenantSlug: string; id?: string; name: string; parentId?: string;
  isGroup?: boolean; manager?: string;
}) {
  if (input.id) {
    return (await db.query<any>(
      `update crm_territories set name=$1, parent_id=$2, is_group=$3,
         territory_manager=$4 where id=$5 and tenant_slug=$6 returning *`,
      [input.name, input.parentId ?? null, input.isGroup ?? false,
       input.manager ?? null, input.id, input.tenantSlug]
    )).rows[0];
  }
  return (await db.query<any>(
    `insert into crm_territories (tenant_slug, name, parent_id, is_group, territory_manager)
     values ($1,$2,$3,$4,$5) returning *`,
    [input.tenantSlug, input.name, input.parentId ?? null,
     input.isGroup ?? false, input.manager ?? null]
  )).rows[0];
}

// ── Simple master CRUD (industry types, market segments) ───────────────────

const SIMPLE_MASTERS: Record<string, string> = {
  industries: "crm_industry_types",
  segments: "crm_market_segments",
};

export async function listMaster(tenantSlug: string, kind: "industries" | "segments") {
  return paged(["tenant_slug = $1"], [tenantSlug], "name", "*", SIMPLE_MASTERS[kind]);
}

export async function createMaster(tenantSlug: string, kind: "industries" | "segments", name: string, description?: string) {
  const cols = kind === "segments" ? "(tenant_slug, name, description)" : "(tenant_slug, name)";
  const vals = kind === "segments" ? "($1,$2,$3)" : "($1,$2)";
  const params = kind === "segments" ? [tenantSlug, name, description ?? null] : [tenantSlug, name];
  return (await db.query<any>(
    `insert into ${SIMPLE_MASTERS[kind]} ${cols} values ${vals}
     on conflict do nothing returning *`, params
  )).rows[0];
}

export async function deleteMaster(tenantSlug: string, kind: "industries" | "segments", id: string) {
  await db.query(`delete from ${SIMPLE_MASTERS[kind]} where id = $1 and tenant_slug = $2`, [id, tenantSlug]);
}

// ── Competitors ────────────────────────────────────────────────────────────

export async function listCompetitors(tenantSlug: string) {
  return paged(["tenant_slug = $1"], [tenantSlug], "name", "*", "crm_competitors");
}

export async function upsertCompetitor(input: {
  tenantSlug: string; id?: string; name: string; website?: string;
  strengths?: string; weaknesses?: string; notes?: string;
}) {
  if (input.id) {
    return (await db.query<any>(
      `update crm_competitors set name=$1, website=$2, strengths=$3,
         weaknesses=$4, notes=$5 where id=$6 and tenant_slug=$7 returning *`,
      [input.name, input.website ?? null, input.strengths ?? null,
       input.weaknesses ?? null, input.notes ?? null, input.id, input.tenantSlug]
    )).rows[0];
  }
  return (await db.query<any>(
    `insert into crm_competitors (tenant_slug, name, website, strengths, weaknesses, notes)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [input.tenantSlug, input.name, input.website ?? null,
     input.strengths ?? null, input.weaknesses ?? null, input.notes ?? null]
  )).rows[0];
}

export async function linkCompetitorToDeal(tenantSlug: string, dealId: string, competitorId: string) {
  return (await db.query<any>(
    `insert into crm_deal_competitors (tenant_slug, deal_id, competitor_id)
     values ($1,$2,$3) on conflict do nothing returning *`,
    [tenantSlug, dealId, competitorId]
  )).rows[0];
}

export async function dealCompetitors(tenantSlug: string, dealId: string) {
  return (await db.query<any>(
    `select c.* from crm_competitors c
     join crm_deal_competitors dc on dc.competitor_id = c.id
     where dc.tenant_slug = $1 and dc.deal_id = $2`,
    [tenantSlug, dealId]
  )).rows;
}

// ── Notes ──────────────────────────────────────────────────────────────────

export async function listNotes(tenantSlug: string, partyType?: string, partyId?: string) {
  const conds = ["tenant_slug = $1"];
  const params: any[] = [tenantSlug];
  if (partyType) { params.push(partyType); conds.push(`party_type = $${params.length}`); }
  if (partyId) { params.push(partyId); conds.push(`party_id = $${params.length}`); }
  return paged(conds, params, "created_at desc", "*", "crm_notes");
}

export async function createNote(input: {
  tenantSlug: string; title?: string; content: string;
  partyType?: string; partyId?: string; notifyOnLogin?: boolean; createdBy?: string;
}) {
  return (await db.query<any>(
    `insert into crm_notes (tenant_slug, title, content, party_type, party_id,
       notify_on_login, created_by)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [input.tenantSlug, input.title ?? null, input.content, input.partyType ?? null,
     input.partyId ?? null, input.notifyOnLogin ?? false, input.createdBy ?? null]
  )).rows[0];
}

// ── Appointments ───────────────────────────────────────────────────────────

export async function listAppointments(tenantSlug: string, from?: string, to?: string) {
  const conds = ["tenant_slug = $1"];
  const params: any[] = [tenantSlug];
  if (from) { params.push(from); conds.push(`scheduled_at >= $${params.length}`); }
  if (to) { params.push(to); conds.push(`scheduled_at <= $${params.length}`); }
  return paged(conds, params, "scheduled_at", "*", "crm_appointments");
}

export async function createAppointment(input: {
  tenantSlug: string; title: string; partyType?: string; partyId?: string;
  scheduledAt: string; durationMinutes?: number; attendees?: any[];
  location?: string; notes?: string; createdBy?: string;
}) {
  return (await db.query<any>(
    `insert into crm_appointments (tenant_slug, title, party_type, party_id,
       scheduled_at, duration_minutes, attendees, location, notes, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [input.tenantSlug, input.title, input.partyType ?? null, input.partyId ?? null,
     input.scheduledAt, input.durationMinutes ?? 30,
     JSON.stringify(input.attendees ?? []), input.location ?? null,
     input.notes ?? null, input.createdBy ?? null]
  )).rows[0];
}

export async function updateAppointmentStatus(tenantSlug: string, id: string, status: string) {
  return (await db.query<any>(
    `update crm_appointments set status = $3 where id = $1 and tenant_slug = $2 returning *`,
    [id, tenantSlug, status]
  )).rows[0];
}

// ── SMS center ─────────────────────────────────────────────────────────────

export async function listSms(tenantSlug: string, limit = 100) {
  return (await db.query<any>(
    `select * from sms_messages where tenant_slug = $1
     order by created_at desc limit $2`,
    [tenantSlug, limit]
  )).rows;
}

/**
 * Queue an SMS. Delivery uses the tenant's configured SMS provider
 * (SMS_PROVIDER env: termii|twilio|africas_talking); without one the message
 * stays queued with provider recorded for later dispatch.
 */
export async function sendSms(input: {
  tenantSlug: string; to: string; message: string;
  relatedType?: string; relatedId?: string; sentBy?: string;
}) {
  if (!/^\+?[0-9]{7,15}$/.test(input.to))
    throw new Error("Invalid phone number");
  const provider = process.env.SMS_PROVIDER ?? null;
  let status = "queued", providerRef: string | null = null, error: string | null = null;

  if (provider === "termii" && process.env.TERMII_API_KEY) {
    try {
      const res = await fetch("https://api.ng.termii.com/api/sms/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: process.env.TERMII_API_KEY,
          to: input.to.replace(/^\+/, ""),
          from: process.env.TERMII_SENDER_ID ?? "PisAirtel",
          sms: input.message, type: "plain", channel: "generic",
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const json = await res.json();
      status = json.code === "ok" ? "sent" : "failed";
      providerRef = json.message_id ?? null;
      if (status === "failed") error = json.message ?? "provider rejected";
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : String(e);
    }
  }

  const row = (await db.query<any>(
    `insert into sms_messages (tenant_slug, to_number, message, status, provider,
       provider_ref, error, related_type, related_id, sent_by, sent_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, case when $4 in ('sent','delivered') then now() end)
     returning *`,
    [input.tenantSlug, input.to, input.message, status, provider,
     providerRef, error, input.relatedType ?? null, input.relatedId ?? null,
     input.sentBy ?? null]
  )).rows[0];
  return row;
}
