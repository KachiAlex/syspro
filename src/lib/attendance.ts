import { Pool } from "pg";
import AttendanceConfidenceCalculator from "@/lib/attendance-calculator";
import { AttendancePolicy } from "@/lib/attendance-types";

const DEFAULT_DB_URL = process.env.ATTENDANCE_DATABASE_URL || process.env.DATABASE_URL || "postgresql://devuser:devpass@localhost:5433/devdb";

const globalAny: any = globalThis as any;
if (!globalAny.__attendance_pool) {
  globalAny.__attendance_pool = new Pool({ connectionString: DEFAULT_DB_URL });
}
const pool: Pool = globalAny.__attendance_pool;

function mapRowKeys(row: any) {
  if (!row || typeof row !== "object") return row;
  const out: any = {};
  for (const k of Object.keys(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = row[k];
  }
  return out;
}

async function getPolicyForTenant(tenantId?: string): Promise<AttendancePolicy> {
  if (!tenantId) {
    return {
      id: "default",
      tenantId: "",
      name: "default",
      presentThreshold: 70,
      lowConfidenceThreshold: 40,
      checkInWeight: 30,
      taskActivityWeight: 25,
      timeLoggedWeight: 25,
      meetingsWeight: 10,
      trainingWeight: 10,
      requiresCheckIn: true,
      allowsLateCheckIn: true,
      lateCheckInWindowMinutes: 30,
      requiresShiftConfirmation: false,
      requiresWeeklyAvailabilityConfirmation: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as AttendancePolicy;
  }

  try {
    const res = await pool.query("SELECT * FROM attendance_policies WHERE tenant_id = $1 LIMIT 1", [tenantId]);
    if (res.rowCount && res.rowCount > 0) return mapRowKeys(res.rows[0]) as AttendancePolicy;
  } catch (err) {
    console.warn("Could not load attendance policy:", err instanceof Error ? err.message : err);
  }

  return {
    id: "default",
    tenantId: tenantId || "",
    name: "default",
    presentThreshold: 70,
    lowConfidenceThreshold: 40,
    checkInWeight: 30,
    taskActivityWeight: 25,
    timeLoggedWeight: 25,
    meetingsWeight: 10,
    trainingWeight: 10,
    requiresCheckIn: true,
    allowsLateCheckIn: true,
    lateCheckInWindowMinutes: 30,
    requiresShiftConfirmation: false,
    requiresWeeklyAvailabilityConfirmation: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } as AttendancePolicy;
}

export async function getAttendance(params: { action?: string; tenantId?: string | null; employeeId?: string | null; limit?: number }) {
  const action = params.action || "today";
  const limit = params.limit || 50;

  // Simple implementation: return most recent attendance records (tenant filtered if provided)
  let query = `SELECT id, tenant_id, employee_id, work_date, confidence_score, attendance_status, work_mode, check_in_time, check_out_time, task_activity_count, time_logged_hours, meetings_attended, lms_activity_score FROM attendance_records`;
  const values: any[] = [];
  if (params.tenantId) {
    values.push(params.tenantId);
    query += ` WHERE tenant_id = $1`;
  }
  query += ` ORDER BY work_date DESC LIMIT $${values.length + 1}`;
  values.push(limit);

  const res = await pool.query(query, values);
  return { action, items: res.rows.map(mapRowKeys) };
}

export async function handleAttendanceAction(body: any) {
  const action = body?.action;
  const tenantId = body?.tenantId || body?.tenant_id || null;
  const employeeId = body?.employeeId || body?.employee_id;
  const workDate = body?.workDate || new Date().toISOString().slice(0, 10);

  if (!employeeId) throw new Error("employeeId required");

  if (action === "check-in") {
    const checkInTime = body.checkInTime || new Date().toISOString();
    await pool.query(
      `INSERT INTO attendance_records (tenant_id, employee_id, work_date, check_in_time, work_mode, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
       ON CONFLICT (tenant_id, employee_id, work_date) DO UPDATE SET check_in_time = EXCLUDED.check_in_time, updated_at = NOW()`,
      [tenantId, employeeId, workDate, checkInTime, body.workMode || 'ONSITE']
    );
    return { ok: true, action: 'check-in', employeeId, workDate };
  }

  if (action === "check-out") {
    const checkOutTime = body.checkOutTime || new Date().toISOString();
    await pool.query(
      `UPDATE attendance_records SET check_out_time = $1, updated_at = NOW() WHERE tenant_id = $2 AND employee_id = $3 AND work_date = $4`,
      [checkOutTime, tenantId, employeeId, workDate]
    );
    return { ok: true, action: 'check-out', employeeId, workDate };
  }

  if (action === "set-mode") {
    const mode = body.workMode || body.mode;
    await pool.query(
      `INSERT INTO attendance_records (tenant_id, employee_id, work_date, work_mode, created_at, updated_at)
       VALUES ($1,$2,$3,$4,NOW(),NOW())
       ON CONFLICT (tenant_id, employee_id, work_date) DO UPDATE SET work_mode = EXCLUDED.work_mode, updated_at = NOW()`,
      [tenantId, employeeId, workDate, mode]
    );
    return { ok: true, action: 'set-mode', mode };
  }

  if (action === "override") {
    const { newStatus, reason, overrideByUserId } = body;
    // Update record and insert into override log
    const recRes = await pool.query(`SELECT id, confidence_score FROM attendance_records WHERE tenant_id=$1 AND employee_id=$2 AND work_date=$3`, [tenantId, employeeId, workDate]);
    const attendanceId = recRes.rowCount ? recRes.rows[0].id : null;
    if (attendanceId) {
      await pool.query(`UPDATE attendance_records SET attendance_status=$1, is_override=true, override_reason=$2, override_by_user_id=$3, updated_at=NOW() WHERE id=$4`, [newStatus, reason, overrideByUserId, attendanceId]);
      await pool.query(`INSERT INTO attendance_override_logs (tenant_id, attendance_record_id, overridden_by_user_id, previous_status, new_status, previous_confidence_score, new_confidence_score, reason, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`, [tenantId, attendanceId, overrideByUserId, recRes.rows[0].attendance_status, newStatus, recRes.rows[0].confidence_score, body.newConfidenceScore || null, reason]);
      return { ok: true, overridden: true };
    }
    return { ok: false, message: 'record not found' };
  }

  return { ok: false, message: 'unknown action' };
}

export async function updateAttendanceSignals(body: any) {
  const tenantId = body?.tenantId || body?.tenant_id || null;
  const employeeId = body?.employeeId || body?.employee_id;
  const workDate = body?.workDate || new Date().toISOString().slice(0, 10);
  const signalType = body.signalType || body.type;
  const signalData = body.signalData || body.data || {};

  if (!employeeId || !signalType) throw new Error('employeeId and signalType required');

  // Insert signal
  await pool.query(`INSERT INTO attendance_signals (tenant_id, employee_id, attendance_record_id, signal_type, signal_data, confidence_weight, source, source_reference_id, created_at) VALUES ($1,$2,(SELECT id FROM attendance_records WHERE tenant_id=$1 AND employee_id=$2 AND work_date=$3),$4,$5,$6,$7,$8,NOW())`, [tenantId, employeeId, workDate, signalType, JSON.stringify(signalData), signalData.confidenceWeight || null, body.source || 'api', body.sourceReferenceId || null]);

  // Update aggregates
  if (signalType === 'TASK_UPDATE') {
    const count = signalData.count || 1;
    await pool.query(`UPDATE attendance_records SET task_activity_count = COALESCE(task_activity_count,0) + $1, updated_at=NOW() WHERE tenant_id=$2 AND employee_id=$3 AND work_date=$4`, [count, tenantId, employeeId, workDate]);
  }
  if (signalType === 'TIME_LOG') {
    const hours = signalData.hours || 0;
    await pool.query(`UPDATE attendance_records SET time_logged_hours = COALESCE(time_logged_hours,0) + $1, updated_at=NOW() WHERE tenant_id=$2 AND employee_id=$3 AND work_date=$4`, [hours, tenantId, employeeId, workDate]);
  }
  if (signalType === 'MEETING_ATTENDED') {
    await pool.query(`UPDATE attendance_records SET meetings_attended = COALESCE(meetings_attended,0) + 1, updated_at=NOW() WHERE tenant_id=$1 AND employee_id=$2 AND work_date=$3`, [tenantId, employeeId, workDate]);
  }
  if (signalType === 'LMS_ACTIVITY') {
    const score = signalData.score || 0;
    await pool.query(`UPDATE attendance_records SET lms_activity_score = GREATEST(COALESCE(lms_activity_score,0), $1), updated_at=NOW() WHERE tenant_id=$2 AND employee_id=$3 AND work_date=$4`, [score, tenantId, employeeId, workDate]);
  }

  // Recompute confidence score and status
  const recRes = await pool.query(`SELECT * FROM attendance_records WHERE tenant_id=$1 AND employee_id=$2 AND work_date=$3 LIMIT 1`, [tenantId, employeeId, workDate]);
  if (recRes.rowCount === 0) return { ok: false, message: 'attendance record not found' };
  const record = mapRowKeys(recRes.rows[0]);

  const policy = await getPolicyForTenant(record.tenantId);
  const taskScore = AttendanceConfidenceCalculator.calculateTaskActivityScore(record.taskActivityCount || 0);
  const timeScore = AttendanceConfidenceCalculator.calculateTimeLoggedScore(record.timeLoggedHours || 0);
  const meetingScore = AttendanceConfidenceCalculator.calculateMeetingScore(record.meetingsAttended || 0);
  const trainingScore = AttendanceConfidenceCalculator.calculateTrainingScore(record.lmsActivityScore || 0);

  const acs = AttendanceConfidenceCalculator.calculateACS({ checkInProvided: !!record.checkInTime, taskActivityScore: taskScore, timeLoggedScore: timeScore, communicationScore: meetingScore, trainingScore: trainingScore }, policy as AttendancePolicy);

  const status = AttendanceConfidenceCalculator.getAttendanceStatus(acs, policy as AttendancePolicy, record as any);

  await pool.query(`UPDATE attendance_records SET confidence_score=$1, attendance_status=$2, updated_at=NOW() WHERE id=$3`, [acs, status, record.id]);

  return { ok: true, confidenceScore: acs, attendanceStatus: status };
}

