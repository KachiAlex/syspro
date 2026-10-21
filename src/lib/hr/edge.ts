import { db } from "@/lib/sql-client";
import { postGLEntry, GL_ACCOUNTS } from "@/lib/finance/gl";

// HRMS edge features: leave encashment, overtime, grievances, transfers,
// skill maps, training, staffing plans, employee tax declarations.

// ── Leave encashment ───────────────────────────────────────────────────────

export async function listEncashments(tenantSlug: string, employeeId?: string) {
  const conds = ["tenant_slug = $1"];
  const params: any[] = [tenantSlug];
  if (employeeId) { params.push(employeeId); conds.push(`employee_id = $${params.length}`); }
  return (await db.query<any>(
    `select * from leave_encashments where ${conds.join(" and ")}
     order by created_at desc`, params
  )).rows;
}

export async function createEncashment(input: {
  tenantSlug: string; employeeId: string; leaveType: string;
  encashableDays: number; ratePerDay: number; createdBy?: string;
}) {
  if (input.encashableDays <= 0) throw new Error("encashable days must be > 0");
  const amount = input.encashableDays * input.ratePerDay;
  return (await db.query<any>(
    `insert into leave_encashments (tenant_slug, employee_id, leave_type,
       encashable_days, rate_per_day, amount, created_by)
     values ($1,$2,$3,$4,$5,$6,$7) returning *`,
    [input.tenantSlug, input.employeeId, input.leaveType,
     input.encashableDays, input.ratePerDay, amount, input.createdBy ?? null]
  )).rows[0];
}

/** Approve: post Dr salary expense / Cr payroll payable for the encashment. */
export async function approveEncashment(tenantSlug: string, id: string, userId?: string) {
  const row = (await db.query<any>(
    `update leave_encashments set status = 'approved'
     where id = $1 and tenant_slug = $2 and status = 'draft' returning *`,
    [id, tenantSlug]
  )).rows[0];
  if (!row) throw new Error("Encashment not found or not in draft");
  await postGLEntry({
    tenantSlug,
    entryDate: new Date().toISOString().slice(0, 10),
    journalType: "SYSTEM",
    referenceType: "leave_encashment",
    referenceId: id,
    description: `Leave encashment: ${row.employee_id} ${row.encashable_days}d ${row.leave_type}`,
    createdBy: userId ?? "system",
    lines: [
      { accountCode: GL_ACCOUNTS.SALARIES_WAGES, debitAmount: Number(row.amount) },
      { accountCode: GL_ACCOUNTS.PAYROLL_PAYABLE, creditAmount: Number(row.amount) },
    ],
  });
  return row;
}

export async function setEncashmentStatus(tenantSlug: string, id: string, status: "paid" | "rejected" | "cancelled", payrollRunId?: string) {
  return (await db.query<any>(
    `update leave_encashments set status = $3, payroll_run_id = coalesce($4, payroll_run_id)
     where id = $1 and tenant_slug = $2 and status in ('draft','approved') returning *`,
    [id, tenantSlug, status, payrollRunId ?? null]
  )).rows[0];
}

// ── Overtime ───────────────────────────────────────────────────────────────

export async function listOvertime(tenantSlug: string, employeeId?: string, status?: string) {
  const conds = ["tenant_slug = $1"];
  const params: any[] = [tenantSlug];
  if (employeeId) { params.push(employeeId); conds.push(`employee_id = $${params.length}`); }
  if (status) { params.push(status); conds.push(`status = $${params.length}`); }
  return (await db.query<any>(
    `select * from overtime_entries where ${conds.join(" and ")}
     order by work_date desc`, params
  )).rows;
}

export async function createOvertime(input: {
  tenantSlug: string; employeeId: string; workDate: string;
  hours: number; rateMultiplier?: number; reason?: string;
}) {
  if (input.hours <= 0 || input.hours > 24) throw new Error("hours must be 0–24");
  return (await db.query<any>(
    `insert into overtime_entries (tenant_slug, employee_id, work_date, hours,
       rate_multiplier, reason)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [input.tenantSlug, input.employeeId, input.workDate, input.hours,
     input.rateMultiplier ?? 1.5, input.reason ?? null]
  )).rows[0];
}

export async function setOvertimeStatus(tenantSlug: string, id: string, status: "approved" | "rejected" | "paid", approvedBy?: string) {
  return (await db.query<any>(
    `update overtime_entries set status = $3, approved_by = coalesce($4, approved_by)
     where id = $1 and tenant_slug = $2 and status in ('pending','approved') returning *`,
    [id, tenantSlug, status, approvedBy ?? null]
  )).rows[0];
}

/** Approved overtime hours by employee for a payroll period — for payroll runs. */
export async function approvedOvertimeForPeriod(tenantSlug: string, from: string, to: string) {
  return (await db.query<any>(
    `select employee_id, sum(hours) as hours,
            sum(hours * rate_multiplier) as weighted_hours
     from overtime_entries
     where tenant_slug = $1 and status = 'approved'
       and work_date between $2 and $3
     group by employee_id`,
    [tenantSlug, from, to]
  )).rows;
}

// ── Grievances ─────────────────────────────────────────────────────────────

export async function listGrievances(tenantSlug: string, status?: string) {
  const conds = ["tenant_slug = $1"];
  const params: any[] = [tenantSlug];
  if (status) { params.push(status); conds.push(`status = $${params.length}`); }
  return (await db.query<any>(
    `select * from employee_grievances where ${conds.join(" and ")}
     order by raised_on desc`, params
  )).rows;
}

export async function createGrievance(input: {
  tenantSlug: string; employeeId: string; grievanceType: string;
  subject: string; description?: string; assignedTo?: string;
}) {
  return (await db.query<any>(
    `insert into employee_grievances (tenant_slug, employee_id, grievance_type,
       subject, description, assigned_to)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [input.tenantSlug, input.employeeId, input.grievanceType, input.subject,
     input.description ?? null, input.assignedTo ?? null]
  )).rows[0];
}

export async function resolveGrievance(input: {
  tenantSlug: string; id: string; status: "resolved" | "closed" | "dismissed" | "investigating";
  resolution?: string;
}) {
  return (await db.query<any>(
    `update employee_grievances set status = $3, resolution = coalesce($4, resolution),
       resolved_on = case when $3 in ('resolved','closed','dismissed') then current_date end
     where id = $1 and tenant_slug = $2 returning *`,
    [input.id, input.tenantSlug, input.status, input.resolution ?? null]
  )).rows[0];
}

// ── Transfers ──────────────────────────────────────────────────────────────

export async function listTransfers(tenantSlug: string, employeeId?: string) {
  const conds = ["tenant_slug = $1"];
  const params: any[] = [tenantSlug];
  if (employeeId) { params.push(employeeId); conds.push(`employee_id = $${params.length}`); }
  return (await db.query<any>(
    `select * from employee_transfers where ${conds.join(" and ")}
     order by transfer_date desc`, params
  )).rows;
}

export async function createTransfer(input: {
  tenantSlug: string; employeeId: string; transferDate: string;
  fromDepartmentId?: string; toDepartmentId?: string;
  fromBranchId?: string; toBranchId?: string; reason?: string; createdBy?: string;
}) {
  return (await db.query<any>(
    `insert into employee_transfers (tenant_slug, employee_id, from_department_id,
       to_department_id, from_branch_id, to_branch_id, transfer_date, reason,
       created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [input.tenantSlug, input.employeeId, input.fromDepartmentId ?? null,
     input.toDepartmentId ?? null, input.fromBranchId ?? null,
     input.toBranchId ?? null, input.transferDate, input.reason ?? null,
     input.createdBy ?? null]
  )).rows[0];
}

/** Complete: apply the transfer to admin_employees. */
export async function completeTransfer(tenantSlug: string, id: string) {
  const t = (await db.query<any>(
    `update employee_transfers set status = 'completed'
     where id = $1 and tenant_slug = $2 and status in ('draft','approved') returning *`,
    [id, tenantSlug]
  )).rows[0];
  if (!t) throw new Error("Transfer not found or already completed");
  const sets: string[] = [];
  const params: any[] = [t.employee_id, tenantSlug];
  if (t.to_department_id) { params.push(t.to_department_id); sets.push(`department_id = $${params.length}`); }
  if (t.to_branch_id) { params.push(t.to_branch_id); sets.push(`branch_id = $${params.length}`); }
  if (sets.length) {
    await db.query(
      `update admin_employees set ${sets.join(", ")}, updated_at = now()
       where id = $1 and tenant_slug = $2`, params
    );
  }
  return t;
}

// ── Skill maps ─────────────────────────────────────────────────────────────

export async function listSkillMaps(tenantSlug: string, employeeId?: string) {
  const conds = ["tenant_slug = $1"];
  const params: any[] = [tenantSlug];
  if (employeeId) { params.push(employeeId); conds.push(`employee_id = $${params.length}`); }
  return (await db.query<any>(
    `select * from employee_skill_maps where ${conds.join(" and ")}
     order by skill`, params
  )).rows;
}

export async function upsertSkill(input: {
  tenantSlug: string; employeeId: string; skill: string;
  proficiency: number; evaluator?: string;
}) {
  return (await db.query<any>(
    `insert into employee_skill_maps (tenant_slug, employee_id, skill,
       proficiency, evaluator)
     values ($1,$2,$3,$4,$5)
     on conflict (tenant_slug, employee_id, skill) do update set
       proficiency = excluded.proficiency, evaluated_on = current_date,
       evaluator = excluded.evaluator
     returning *`,
    [input.tenantSlug, input.employeeId, input.skill, input.proficiency,
     input.evaluator ?? null]
  )).rows[0];
}

/** Employees holding a skill at or above a proficiency — for staffing. */
export async function findBySkill(tenantSlug: string, skill: string, minProficiency = 1) {
  return (await db.query<any>(
    `select s.*, e.name as employee_name from employee_skill_maps s
     left join admin_employees e on e.id::text = s.employee_id
     where s.tenant_slug = $1 and lower(s.skill) = lower($2)
       and s.proficiency >= $3
     order by s.proficiency desc`,
    [tenantSlug, skill, minProficiency]
  )).rows;
}

// ── Training ───────────────────────────────────────────────────────────────

export async function listTrainingPrograms(tenantSlug: string) {
  return (await db.query<any>(
    `select * from training_programs where tenant_slug = $1 order by name`, [tenantSlug]
  )).rows;
}

export async function createTrainingProgram(input: {
  tenantSlug: string; name: string; description?: string; supplier?: string;
}) {
  return (await db.query<any>(
    `insert into training_programs (tenant_slug, name, description, supplier)
     values ($1,$2,$3,$4) on conflict do nothing returning *`,
    [input.tenantSlug, input.name, input.description ?? null, input.supplier ?? null]
  )).rows[0];
}

export async function listTrainingEvents(tenantSlug: string, status?: string) {
  const conds = ["e.tenant_slug = $1"];
  const params: any[] = [tenantSlug];
  if (status) { params.push(status); conds.push(`e.status = $${params.length}`); }
  return (await db.query<any>(
    `select e.*, p.name as program_name from training_events e
     left join training_programs p on p.id = e.program_id
     where ${conds.join(" and ")} order by e.start_date desc`, params
  )).rows;
}

export async function createTrainingEvent(input: {
  tenantSlug: string; programId?: string; eventName: string;
  startDate: string; endDate?: string; venue?: string; trainer?: string;
  attendees?: { employeeId: string; name?: string }[];
}) {
  return (await db.query<any>(
    `insert into training_events (tenant_slug, program_id, event_name,
       start_date, end_date, venue, trainer, attendees)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [input.tenantSlug, input.programId ?? null, input.eventName,
     input.startDate, input.endDate ?? null, input.venue ?? null,
     input.trainer ?? null, JSON.stringify(input.attendees ?? [])]
  )).rows[0];
}

export async function updateTrainingEvent(input: {
  tenantSlug: string; id: string; status?: string;
  attendees?: { employeeId: string; name?: string; status?: string }[];
}) {
  return (await db.query<any>(
    `update training_events set status = coalesce($3, status),
       attendees = coalesce($4, attendees)
     where id = $1 and tenant_slug = $2 returning *`,
    [input.id, input.tenantSlug, input.status ?? null,
     input.attendees ? JSON.stringify(input.attendees) : null]
  )).rows[0];
}

// ── Staffing plans ─────────────────────────────────────────────────────────

export async function listStaffingPlans(tenantSlug: string) {
  return (await db.query<any>(
    `select * from staffing_plans where tenant_slug = $1
     order by created_at desc`, [tenantSlug]
  )).rows;
}

export async function createStaffingPlan(input: {
  tenantSlug: string; name: string; departmentId?: string;
  periodFrom?: string; periodTo?: string;
  designations: { designation: string; count: number; estCost: number }[];
  createdBy?: string;
}) {
  const total = input.designations.reduce((s, d) => s + d.count * d.estCost, 0);
  return (await db.query<any>(
    `insert into staffing_plans (tenant_slug, name, department_id, period_from,
       period_to, designations, total_estimated_cost, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [input.tenantSlug, input.name, input.departmentId ?? null,
     input.periodFrom ?? null, input.periodTo ?? null,
     JSON.stringify(input.designations), total, input.createdBy ?? null]
  )).rows[0];
}

export async function setStaffingPlanStatus(tenantSlug: string, id: string, status: "submitted" | "approved" | "cancelled") {
  return (await db.query<any>(
    `update staffing_plans set status = $3
     where id = $1 and tenant_slug = $2 and status != 'cancelled' returning *`,
    [id, tenantSlug, status]
  )).rows[0];
}

// ── Tax declarations (NG PAYE reliefs) ─────────────────────────────────────

export async function listTaxDeclarations(tenantSlug: string, employeeId?: string, year?: number) {
  const conds = ["tenant_slug = $1"];
  const params: any[] = [tenantSlug];
  if (employeeId) { params.push(employeeId); conds.push(`employee_id = $${params.length}`); }
  if (year) { params.push(year); conds.push(`tax_year = $${params.length}`); }
  return (await db.query<any>(
    `select * from employee_tax_declarations where ${conds.join(" and ")}
     order by tax_year desc`, params
  )).rows;
}

export async function upsertTaxDeclaration(input: {
  tenantSlug: string; employeeId: string; taxYear: number;
  reliefs: { rent?: number; pension?: number; nhf?: number; lifeAssurance?: number; mortgageInterest?: number; other?: number };
  proofDocument?: string;
}) {
  const declared = Object.values(input.reliefs).reduce((s, v) => s + (v ?? 0), 0);
  return (await db.query<any>(
    `insert into employee_tax_declarations (tenant_slug, employee_id, tax_year,
       reliefs, declared_amount, proof_document, status)
     values ($1,$2,$3,$4,$5,$6,'submitted')
     on conflict (tenant_slug, employee_id, tax_year) do update set
       reliefs = excluded.reliefs, declared_amount = excluded.declared_amount,
       proof_document = excluded.proof_document, status = 'submitted'
     returning *`,
    [input.tenantSlug, input.employeeId, input.taxYear,
     JSON.stringify(input.reliefs), declared, input.proofDocument ?? null]
  )).rows[0];
}

export async function setTaxDeclarationStatus(tenantSlug: string, id: string, status: "approved" | "rejected") {
  return (await db.query<any>(
    `update employee_tax_declarations set status = $3
     where id = $1 and tenant_slug = $2 and status = 'submitted' returning *`,
    [id, tenantSlug, status]
  )).rows[0];
}
