import { db } from "@/lib/sql-client";
import { createTicket } from "@/lib/support-db";

// Preventive maintenance schedules + visits, linked to support tickets.

const FREQ_MONTHS: Record<string, number> = {
  weekly: 0.25, monthly: 1, quarterly: 3, yearly: 12,
};

function nextDue(from: Date, frequency: string): string {
  const d = new Date(from);
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + (FREQ_MONTHS[frequency] ?? 1));
  return d.toISOString().slice(0, 10);
}

export async function listSchedules(tenantSlug: string, dueOnly = false) {
  return (await db.query<any>(
    `select * from maintenance_schedules where tenant_slug = $1 and is_active
     ${dueOnly ? "and next_due <= current_date" : ""} order by next_due`,
    [tenantSlug]
  )).rows;
}

export async function createSchedule(input: {
  tenantSlug: string; assetName: string; assetId?: string; itemName?: string;
  frequency: string; nextDue: string; assignedTo?: string; notes?: string;
}) {
  if (!FREQ_MONTHS[input.frequency]) throw new Error("frequency must be weekly|monthly|quarterly|yearly");
  return (await db.query<any>(
    `insert into maintenance_schedules (tenant_slug, asset_id, asset_name,
       item_name, frequency, next_due, assigned_to, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [input.tenantSlug, input.assetId ?? null, input.assetName, input.itemName ?? null,
     input.frequency, input.nextDue, input.assignedTo ?? null, input.notes ?? null]
  )).rows[0];
}

export async function updateSchedule(input: {
  tenantSlug: string; id: string; nextDue?: string; assignedTo?: string;
  isActive?: boolean; frequency?: string; notes?: string;
}) {
  return (await db.query<any>(
    `update maintenance_schedules set
       next_due = coalesce($3, next_due),
       assigned_to = coalesce($4, assigned_to),
       is_active = coalesce($5, is_active),
       frequency = coalesce($6, frequency),
       notes = coalesce($7, notes)
     where id = $1 and tenant_slug = $2 returning *`,
    [input.id, input.tenantSlug, input.nextDue ?? null, input.assignedTo ?? null,
     input.isActive ?? null, input.frequency ?? null, input.notes ?? null]
  )).rows[0];
}

export async function listVisits(tenantSlug: string, scheduleId?: string, status?: string) {
  return (await db.query<any>(
    `select v.*, s.asset_name from maintenance_visits v
     join maintenance_schedules s on s.id = v.schedule_id
     where v.tenant_slug = $1
     ${scheduleId ? "and v.schedule_id = $2" : ""}
     ${status ? `and v.status = '${status}'` : ""}
     order by v.scheduled_date desc`,
    scheduleId ? [tenantSlug, scheduleId] : [tenantSlug]
  )).rows;
}

/** Generate visits + support tickets for due schedules (scheduler entry). */
export async function processDueSchedules(tenantSlug: string) {
  const due = await listSchedules(tenantSlug, true);
  const created: any[] = [];
  for (const s of due) {
    const existing = (await db.query<any>(
      `select 1 from maintenance_visits where schedule_id = $1
         and scheduled_date = $2 and status != 'cancelled'`,
      [s.id, s.next_due]
    )).rows[0];
    if (existing) continue;

    const ticket = await createTicket({
      tenantSlug,
      title: `Preventive maintenance: ${s.asset_name}`,
      description: `Scheduled ${s.frequency} maintenance for ${s.asset_name}${s.item_name ? ` (${s.item_name})` : ""} due ${String(s.next_due).slice(0, 10)}.${s.notes ? `\n\n${s.notes}` : ""}`,
      ticketType: "internal",
      source: "erp",
      impactLevel: "medium",
      priority: "medium",
    });
    const visit = (await db.query<any>(
      `insert into maintenance_visits (tenant_slug, schedule_id, scheduled_date,
         engineer, ticket_id)
       values ($1,$2,$3,$4,$5) returning *`,
      [tenantSlug, s.id, s.next_due, s.assigned_to, ticket.id]
    )).rows[0];
    created.push({ schedule: s.asset_name, visit: visit.id, ticket: ticket.id });
  }
  return { due: due.length, created };
}

export async function completeVisit(input: {
  tenantSlug: string; visitId: string; workDone?: string; engineer?: string;
}) {
  const visit = (await db.query<any>(
    `update maintenance_visits set status='completed', completed_date=current_date,
       work_done = coalesce($3, work_done), engineer = coalesce($4, engineer)
     where id = $1 and tenant_slug = $2 and status != 'completed' returning *`,
    [input.visitId, input.tenantSlug, input.workDone ?? null, input.engineer ?? null]
  )).rows[0];
  if (!visit) throw new Error("Visit not found or already completed");

  // Advance the parent schedule.
  await db.query(
    `update maintenance_schedules set
       last_completed = current_date,
       next_due = $3
     where id = (
       select schedule_id from maintenance_visits where id = $1
     ) and tenant_slug = $2`,
    [input.visitId, input.tenantSlug,
     nextDue(new Date(), (await db.query<any>(
       `select s.frequency from maintenance_schedules s
        join maintenance_visits v on v.schedule_id = s.id where v.id = $1`,
       [input.visitId])).rows[0]?.frequency ?? "monthly")]
  );
  return visit;
}
