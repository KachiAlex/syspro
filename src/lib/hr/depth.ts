import { randomUUID } from "crypto";

import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { postGLEntry, GL_ACCOUNTS } from "@/lib/finance/gl";

export function ensureHrDepthTables() {
  return ensureOnce("hr/depth:ensureTables", ensureHrDepthTablesRun);
}

async function ensureHrDepthTablesRun() {
  const sql = SQL;
  await sql`create table if not exists hr_employee_checkins (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    employee_id text not null,
    timestamp timestamptz not null,
    log_type text not null check (log_type in ('in','out')),
    source text not null default 'manual',
    device_id text,
    shift_id uuid,
    skip_auto_attendance boolean not null default false,
    created_at timestamptz not null default now()
  )`;
  await sql`create index if not exists hr_checkins_emp_idx
    on hr_employee_checkins (tenant_slug, employee_id, timestamp)`;
  await sql`create table if not exists hr_leave_allocations (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    employee_id text not null,
    leave_type text not null,
    year integer not null,
    allocated_days numeric not null default 0,
    carried_over_days numeric not null default 0,
    expires_at date,
    status text not null default 'active' check (status in ('active','expired','cancelled')),
    notes text,
    created_by text,
    created_at timestamptz not null default now(),
    unique (tenant_slug, employee_id, leave_type, year)
  )`;
  await sql`create table if not exists hr_leave_accrual_log (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    employee_id text not null,
    leave_type text not null,
    period text not null,
    days_accrued numeric not null,
    created_at timestamptz not null default now(),
    unique (tenant_slug, employee_id, leave_type, period)
  )`;
  await sql`create table if not exists hr_employee_advances (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    advance_number text not null,
    employee_id text not null,
    employee_name text,
    amount numeric not null check (amount > 0),
    purpose text,
    status text not null default 'requested'
      check (status in ('requested','approved','disbursed','partially_repaid','repaid','rejected','cancelled')),
    approved_by text,
    disbursed_at timestamptz,
    disburse_journal_id uuid,
    repaid_amount numeric not null default 0,
    created_by text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (tenant_slug, advance_number)
  )`;
  await sql`create table if not exists hr_advance_repayments (
    id uuid primary key default gen_random_uuid(),
    advance_id uuid not null references hr_employee_advances(id) on delete cascade,
    amount numeric not null check (amount > 0),
    method text not null default 'payroll',
    journal_entry_id uuid,
    notes text,
    created_by text,
    created_at timestamptz not null default now()
  )`;
  await sql`create table if not exists hr_employee_lifecycle (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    kind text not null check (kind in ('onboarding','separation')),
    employee_id text not null,
    employee_name text,
    status text not null default 'in_progress'
      check (status in ('in_progress','completed','cancelled')),
    designation text,
    department_id text,
    start_date date,
    separation_date date,
    reason text,
    checklist jsonb not null default '[]',
    created_by text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;
}

// ---------------------------------------------------------------------------
// Check-ins (raw punch log — attendance derives from paired in/out)
// ---------------------------------------------------------------------------

export async function recordCheckin(input: {
  tenantSlug: string;
  employeeId: string;
  logType: "in" | "out";
  timestamp?: string;
  source?: string;
  deviceId?: string;
  shiftId?: string;
}) {
  await ensureHrDepthTables();
  return (await db.query(
    `INSERT INTO hr_employee_checkins (tenant_slug, employee_id, timestamp, log_type, source, device_id, shift_id)
     VALUES ($1,$2,coalesce($3::timestamptz, now()),$4,$5,$6,$7) RETURNING *`,
    [input.tenantSlug, input.employeeId, input.timestamp ?? null,
     input.logType, input.source ?? "manual", input.deviceId ?? null, input.shiftId ?? null])).rows[0];
}

export async function listCheckins(tenantSlug: string, employeeId?: string, from?: string, to?: string) {
  await ensureHrDepthTables();
  return (await db.query(
    `SELECT * FROM hr_employee_checkins
     WHERE tenant_slug = $1
       AND ($2::text IS NULL OR employee_id = $2)
       AND ($3::timestamptz IS NULL OR timestamp >= $3::timestamptz)
       AND ($4::timestamptz IS NULL OR timestamp <= $4::timestamptz)
     ORDER BY timestamp DESC LIMIT 500`,
    [tenantSlug, employeeId ?? null, from ?? null, to ?? null])).rows;
}

// ---------------------------------------------------------------------------
// Leave allocations + periodic accrual
// ---------------------------------------------------------------------------

export async function upsertLeaveAllocation(input: {
  tenantSlug: string;
  employeeId: string;
  leaveType: string;
  year: number;
  allocatedDays: number;
  carriedOverDays?: number;
  expiresAt?: string;
  notes?: string;
  createdBy?: string;
}) {
  await ensureHrDepthTables();
  const row = (await db.query(
    `INSERT INTO hr_leave_allocations
       (tenant_slug, employee_id, leave_type, year, allocated_days, carried_over_days, expires_at, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (tenant_slug, employee_id, leave_type, year) DO UPDATE SET
       allocated_days = excluded.allocated_days,
       carried_over_days = excluded.carried_over_days,
       expires_at = excluded.expires_at,
       status = 'active',
       notes = excluded.notes
     RETURNING *`,
    [input.tenantSlug, input.employeeId, input.leaveType, input.year,
     input.allocatedDays, input.carriedOverDays ?? 0, input.expiresAt ?? null,
     input.notes ?? null, input.createdBy ?? null])).rows[0];

  // Sync the balance row's entitlement so downstream checks see the allocation
  await db.query(
    `INSERT INTO admin_leave_balances (id, tenant_slug, employee_id, leave_type, year, entitled, carried_over, entitlement_set)
     VALUES ($1,$2,$3,$4,$5,$6,$7,true)
     ON CONFLICT (tenant_slug, employee_id, leave_type, year) DO UPDATE SET
       entitled = excluded.allocated_days + excluded.carried_over,
       carried_over = excluded.carried_over_days,
       entitlement_set = true`,
    [randomUUID(), input.tenantSlug, input.employeeId, input.leaveType, input.year,
     input.allocatedDays + (input.carriedOverDays ?? 0), input.carriedOverDays ?? 0])
    .catch(async () => {
      // balance upsert shape differs — patch with update
      await db.query(
        `UPDATE admin_leave_balances
         SET entitled = $1, carried_over = $2, entitlement_set = true
         WHERE tenant_slug = $3 AND employee_id = $4 AND leave_type = $5 AND year = $6`,
        [input.allocatedDays + (input.carriedOverDays ?? 0), input.carriedOverDays ?? 0,
         input.tenantSlug, input.employeeId, input.leaveType, input.year]);
    });
  return row;
}

export async function listLeaveAllocations(tenantSlug: string, year?: number, employeeId?: string) {
  await ensureHrDepthTables();
  return (await db.query(
    `SELECT * FROM hr_leave_allocations
     WHERE tenant_slug = $1
       AND ($2::int IS NULL OR year = $2)
       AND ($3::text IS NULL OR employee_id = $3)
     ORDER BY employee_id, leave_type`,
    [tenantSlug, year ?? null, employeeId ?? null])).rows;
}

/**
 * Periodic accrual: for each employee on a monthly-accrual policy, credit
 * (entitled_days / 12) once per month — deduped by the accrual log so
 * reruns are safe.
 */
export async function runLeaveAccrual(tenantSlug: string, period?: string) {
  await ensureHrDepthTables();
  const now = new Date();
  const targetPeriod = period ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const year = Number(targetPeriod.split("-")[0]);

  const policies = (await db.query(
    `SELECT DISTINCT ON (leave_type) * FROM admin_leave_policies
     WHERE tenant_slug = $1 AND is_active AND accrual = 'monthly'
     ORDER BY leave_type, effective_from DESC`,
    [tenantSlug])).rows;
  if (!policies.length) return { accrued: 0 };

  const employees = (await db.query(
    `SELECT id, name FROM admin_employees
     WHERE tenant_slug = $1 AND (status IS NULL OR status = 'active')`,
    [tenantSlug])).rows;

  let accrued = 0;
  for (const policy of policies) {
    const daysPerMonth = Number(policy.entitled_days) / 12;
    for (const emp of employees) {
      const existing = (await db.query(
        `SELECT id FROM hr_leave_accrual_log
         WHERE tenant_slug = $1 AND employee_id = $2 AND leave_type = $3 AND period = $4`,
        [tenantSlug, emp.id, policy.leave_type, targetPeriod])).rows[0];
      if (existing) continue;

      await db.query(
        `INSERT INTO hr_leave_accrual_log (tenant_slug, employee_id, leave_type, period, days_accrued)
         VALUES ($1,$2,$3,$4,$5)`,
        [tenantSlug, emp.id, policy.leave_type, targetPeriod, daysPerMonth]);
      await db.query(
        `INSERT INTO admin_leave_balances (id, tenant_slug, employee_id, employee_name, leave_type, year, entitled)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (tenant_slug, employee_id, leave_type, year)
         DO UPDATE SET entitled = admin_leave_balances.entitled + $7, updated_at = now()`,
        [randomUUID(), tenantSlug, emp.id, emp.name ?? null, policy.leave_type, year, daysPerMonth])
        .catch(() => {});
      accrued++;
    }
  }
  return { accrued, period: targetPeriod };
}

// ---------------------------------------------------------------------------
// Employee advances (GL: staff advances asset <-> bank)
// ---------------------------------------------------------------------------

function nextAdvanceNumber() {
  return `ADV-${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 4).toUpperCase()}`;
}

export async function createAdvance(input: {
  tenantSlug: string;
  employeeId: string;
  employeeName?: string;
  amount: number;
  purpose?: string;
  createdBy?: string;
}) {
  await ensureHrDepthTables();
  return (await db.query(
    `INSERT INTO hr_employee_advances (tenant_slug, advance_number, employee_id, employee_name, amount, purpose, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [input.tenantSlug, nextAdvanceNumber(), input.employeeId, input.employeeName ?? null,
     input.amount, input.purpose ?? null, input.createdBy ?? null])).rows[0];
}

export async function listAdvances(tenantSlug: string, employeeId?: string, status?: string) {
  await ensureHrDepthTables();
  return (await db.query(
    `SELECT a.*, (SELECT COALESCE(sum(r.amount),0) FROM hr_advance_repayments r WHERE r.advance_id = a.id) AS repaid
     FROM hr_employee_advances a
     WHERE a.tenant_slug = $1
       AND ($2::text IS NULL OR a.employee_id = $2)
       AND ($3::text IS NULL OR a.status = $3)
     ORDER BY a.created_at DESC`,
    [tenantSlug, employeeId ?? null, status ?? null])).rows;
}

export async function updateAdvanceStatus(tenantSlug: string, advanceId: string, status: "approved" | "rejected" | "cancelled", approverId?: string) {
  await ensureHrDepthTables();
  const row = (await db.query(
    `UPDATE hr_employee_advances
     SET status = $1, approved_by = coalesce($2, approved_by), updated_at = now()
     WHERE id = $3 AND tenant_slug = $4 AND status = 'requested' RETURNING *`,
    [status, approverId ?? null, advanceId, tenantSlug])).rows[0];
  if (!row) throw new Error("Advance not found or not in requested state");
  return row;
}

/** Disburse an approved advance — posts Dr Staff Advances / Cr Bank. */
export async function disburseAdvance(tenantSlug: string, advanceId: string, userId?: string) {
  await ensureHrDepthTables();
  const adv = (await db.query(
    `UPDATE hr_employee_advances SET status = 'disbursed', disbursed_at = now(), updated_at = now()
     WHERE id = $1 AND tenant_slug = $2 AND status = 'approved' RETURNING *`,
    [advanceId, tenantSlug])).rows[0];
  if (!adv) throw new Error("Advance not found or not approved");

  const je = await postGLEntry({
    tenantSlug,
    entryDate: new Date(),
    journalType: "SYSTEM",
    referenceType: "employee_advance",
    referenceId: advanceId,
    description: `Employee advance ${adv.advance_number} — ${adv.employee_name ?? adv.employee_id}`,
    lines: [
      { accountCode: GL_ACCOUNTS.STAFF_ADVANCES, debitAmount: Number(adv.amount), description: "Advance disbursed", partyType: "employee", partyId: adv.employee_id },
      { accountCode: GL_ACCOUNTS.BANK, creditAmount: Number(adv.amount), description: "Bank outflow" },
    ],
    createdBy: userId,
  });
  await db.query(`UPDATE hr_employee_advances SET disburse_journal_id = $1 WHERE id = $2`, [je.id, advanceId]);
  return { advance: adv, journalEntryId: je.id };
}

/** Record a repayment — Dr Bank/Cash (or Cr via payroll) / Cr Staff Advances. */
export async function recordRepayment(input: {
  tenantSlug: string;
  advanceId: string;
  amount: number;
  method?: "payroll" | "cash" | "bank" | "expense_offset";
  notes?: string;
  userId?: string;
}) {
  await ensureHrDepthTables();
  const adv = (await db.query(
    `SELECT * FROM hr_employee_advances WHERE id = $1 AND tenant_slug = $2`, [input.advanceId, input.tenantSlug])).rows[0];
  if (!adv) throw new Error("Advance not found");
  if (!["disbursed", "partially_repaid"].includes(adv.status)) throw new Error(`Advance is ${adv.status}`);
  const outstanding = Number(adv.amount) - Number(adv.repaid_amount ?? 0);
  if (input.amount > outstanding) throw new Error(`Repayment exceeds outstanding ${outstanding}`);

  const method = input.method ?? "payroll";
  let jeId: string | null = null;
  if (method !== "payroll") {
    // Payroll recoveries post through the payroll run — cash/bank post now
    const debitAccount = method === "cash" ? GL_ACCOUNTS.CASH : GL_ACCOUNTS.BANK;
    const je = await postGLEntry({
      tenantSlug: input.tenantSlug,
      entryDate: new Date(),
      journalType: "SYSTEM",
      referenceType: "advance_repayment",
      referenceId: input.advanceId,
      description: `Advance repayment ${adv.advance_number} — ${method}`,
      lines: [
        { accountCode: debitAccount, debitAmount: input.amount, description: "Repayment received" },
        { accountCode: GL_ACCOUNTS.STAFF_ADVANCES, creditAmount: input.amount, description: "Advance recovered", partyType: "employee", partyId: adv.employee_id },
      ],
      createdBy: input.userId,
    });
    jeId = je.id;
  }

  await db.query(
    `INSERT INTO hr_advance_repayments (advance_id, amount, method, journal_entry_id, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [input.advanceId, input.amount, method, jeId, input.notes ?? null, input.userId ?? null]);

  const newRepaid = Number(adv.repaid_amount ?? 0) + input.amount;
  await db.query(
    `UPDATE hr_employee_advances
     SET repaid_amount = $1,
         status = CASE WHEN $1 >= amount THEN 'repaid' ELSE 'partially_repaid' END,
         updated_at = now()
     WHERE id = $2`,
    [newRepaid, input.advanceId]);
  return { repaid: newRepaid, fullyRepaid: newRepaid >= Number(adv.amount) };
}

// ---------------------------------------------------------------------------
// Employee lifecycle (onboarding / separation checklists)
// ---------------------------------------------------------------------------

const DEFAULT_ONBOARDING = [
  "Collect signed offer letter", "Create system login", "Assign employee ID",
  "Set up payroll profile", "Assign department & manager", "Issue equipment",
  "Complete induction", "Enroll statutory registrations",
];
const DEFAULT_SEPARATION = [
  "Accept resignation / issue notice", "Complete handover", "Return equipment",
  "Disable system access", "Clear advances & expenses", "Run final payroll",
  "Issue relieving letter", "Exit interview",
];

export async function createLifecycle(input: {
  tenantSlug: string;
  kind: "onboarding" | "separation";
  employeeId: string;
  employeeName?: string;
  designation?: string;
  departmentId?: string;
  startDate?: string;
  separationDate?: string;
  reason?: string;
  checklist?: { task: string; done?: boolean }[];
  createdBy?: string;
}) {
  await ensureHrDepthTables();
  const defaults = input.kind === "onboarding" ? DEFAULT_ONBOARDING : DEFAULT_SEPARATION;
  const checklist = (input.checklist ?? defaults.map((t) => ({ task: t })))
    .map((t: any) => ({ task: t.task, done: t.done ?? false }));
  return (await db.query(
    `INSERT INTO hr_employee_lifecycle
       (tenant_slug, kind, employee_id, employee_name, designation, department_id,
        start_date, separation_date, reason, checklist, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [input.tenantSlug, input.kind, input.employeeId, input.employeeName ?? null,
     input.designation ?? null, input.departmentId ?? null,
     input.startDate ?? null, input.separationDate ?? null,
     input.reason ?? null, JSON.stringify(checklist), input.createdBy ?? null])).rows[0];
}

export async function listLifecycles(tenantSlug: string, kind?: string, status?: string) {
  await ensureHrDepthTables();
  return (await db.query(
    `SELECT * FROM hr_employee_lifecycle
     WHERE tenant_slug = $1
       AND ($2::text IS NULL OR kind = $2)
       AND ($3::text IS NULL OR status = $3)
     ORDER BY created_at DESC`,
    [tenantSlug, kind ?? null, status ?? null])).rows;
}

export async function completeLifecycleTask(tenantSlug: string, lifecycleId: string, taskIndex: number, done: boolean) {
  await ensureHrDepthTables();
  const lc = (await db.query(
    `SELECT * FROM hr_employee_lifecycle WHERE id = $1 AND tenant_slug = $2`, [lifecycleId, tenantSlug])).rows[0];
  if (!lc) throw new Error("Lifecycle record not found");
  const checklist = lc.checklist ?? [];
  if (taskIndex < 0 || taskIndex >= checklist.length) throw new Error("Invalid task index");
  checklist[taskIndex] = { ...checklist[taskIndex], done };
  const allDone = checklist.every((t: any) => t.done);
  await db.query(
    `UPDATE hr_employee_lifecycle
     SET checklist = $1, status = CASE WHEN $2 THEN 'completed' ELSE status END, updated_at = now()
     WHERE id = $3`,
    [JSON.stringify(checklist), allDone, lifecycleId]);
  return { checklist, completed: allDone };
}
