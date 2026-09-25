import { createHmac, timingSafeEqual, randomUUID } from "crypto";
import { db } from "@/lib/sql-client";
import { getSessionSecret } from "@/lib/session";

// ─── Schema ───

let ensured = false;
export async function ensureAttendanceVerificationTables() {
  if (ensured) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS attendance_locations (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      latitude numeric(10,7) not null,
      longitude numeric(10,7) not null,
      radius_m integer not null default 500,
      branch_id text,
      active boolean not null default true,
      created_at timestamptz default now()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_attendance_locations_tenant ON attendance_locations (tenant_slug)`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS attendance_qr_tokens (
      id text primary key,
      tenant_slug text not null,
      location_id text not null references attendance_locations(id) on delete cascade,
      expires_at timestamptz not null,
      revoked_at timestamptz,
      created_by text,
      created_at timestamptz default now()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_attendance_qr_tokens_loc ON attendance_qr_tokens (location_id, expires_at)`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS remote_day_requests (
      id text primary key,
      tenant_slug text not null,
      employee_id text not null,
      employee_name text,
      work_date date not null,
      reason text,
      status text not null default 'pending' check (status in ('pending','approved','rejected')),
      decided_by text,
      decided_at timestamptz,
      created_at timestamptz default now(),
      unique (tenant_slug, employee_id, work_date)
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_remote_day_requests_tenant ON remote_day_requests (tenant_slug, status)`);

  await db.query(`ALTER TABLE IF EXISTS admin_employees ADD COLUMN IF NOT EXISTS work_mode text default 'ONSITE'`);

  await db.query(`ALTER TABLE IF EXISTS attendance_records ADD COLUMN IF NOT EXISTS check_in_method text`);
  await db.query(`ALTER TABLE IF EXISTS attendance_records ADD COLUMN IF NOT EXISTS check_in_distance_m numeric`);
  await db.query(`ALTER TABLE IF EXISTS attendance_records ADD COLUMN IF NOT EXISTS check_in_accuracy_m numeric`);
  await db.query(`ALTER TABLE IF EXISTS attendance_records ADD COLUMN IF NOT EXISTS check_in_flagged boolean default false`);
  await db.query(`ALTER TABLE IF EXISTS attendance_records ADD COLUMN IF NOT EXISTS flag_reason text`);
  await db.query(`ALTER TABLE IF EXISTS attendance_records ADD COLUMN IF NOT EXISTS location_id text`);

  ensured = true;
}

// ─── Geofence ───

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ─── Rotating QR tokens ───

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h rotation

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export async function issueQrToken(locationId: string, tenantSlug: string, createdBy?: string) {
  const jti = randomUUID();
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ lid: locationId, exp, jti })).toString("base64url");
  const token = `${payload}.${sign(payload)}`;

  await db.query(
    `INSERT INTO attendance_qr_tokens (id, tenant_slug, location_id, expires_at, created_by) VALUES ($1,$2,$3,to_timestamp($4/1000.0),$5)`,
    [jti, tenantSlug, locationId, exp, createdBy ?? null]
  );
  // Retire previous tokens for this location so only the newest is valid
  await db.query(
    `UPDATE attendance_qr_tokens SET revoked_at = now() WHERE location_id = $1 AND id <> $2 AND revoked_at IS NULL`,
    [locationId, jti]
  );

  return { token, jti, expiresAt: new Date(exp).toISOString() };
}

export async function verifyQrToken(
  token: string,
  tenantSlug: string
): Promise<{ valid: boolean; locationId?: string; locationName?: string; error?: string }> {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return { valid: false, error: "Malformed token" };
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, error: "Invalid signature" };
  }

  let data: { lid: string; exp: number; jti: string };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return { valid: false, error: "Malformed payload" };
  }
  if (!data.lid || !data.exp || !data.jti) return { valid: false, error: "Malformed payload" };
  if (Date.now() > data.exp) return { valid: false, error: "QR code expired — scan today's code" };

  const res = await db.query(
    `SELECT t.id, t.revoked_at, l.name, l.active
     FROM attendance_qr_tokens t
     JOIN attendance_locations l ON l.id = t.location_id
     WHERE t.id = $1 AND t.tenant_slug = $2`,
    [data.jti, tenantSlug]
  );
  const row = res.rows[0];
  if (!row) return { valid: false, error: "Unknown QR token" };
  if (row.revoked_at) return { valid: false, error: "QR code superseded — scan the current code" };
  if (!row.active) return { valid: false, error: "Location is inactive" };

  return { valid: true, locationId: data.lid, locationName: row.name };
}

// ─── Remote day approval ───

export async function getApprovedRemoteDay(
  tenantSlug: string,
  employeeId: string,
  workDate: string
): Promise<{ approved: boolean; status?: string }> {
  const res = await db.query(
    `SELECT status FROM remote_day_requests WHERE tenant_slug=$1 AND employee_id=$2 AND work_date=$3`,
    [tenantSlug, employeeId, workDate]
  );
  const row = res.rows[0];
  if (!row) return { approved: false };
  return { approved: row.status === "approved", status: row.status };
}

// ─── Check-in verification (shared by portal + attendance routes) ───

export type CheckInVerdict = {
  allowed: boolean;
  method: "qr_geo" | "geo" | "remote_approved" | "field" | "manual";
  flagged: boolean;
  flagReason?: string;
  distanceM?: number;
  locationId?: string;
  error?: string;
};

export async function verifyCheckIn(params: {
  tenantSlug: string;
  employeeId: string;
  workMode: string;
  workDate: string;
  latitude: number | null;
  longitude: number | null;
  accuracyM?: number | null;
  qrToken?: string | null;
}): Promise<CheckInVerdict> {
  const { tenantSlug, employeeId, workMode, workDate, latitude, longitude, accuracyM, qrToken } = params;
  const mode = (workMode || "ONSITE").toUpperCase();
  const hasGeo = typeof latitude === "number" && typeof longitude === "number";

  // REMOTE / HYBRID: need an approved remote day for this date
  if (mode === "REMOTE" || mode === "HYBRID") {
    const remote = await getApprovedRemoteDay(tenantSlug, employeeId, workDate);
    if (remote.approved) {
      return { allowed: true, method: "remote_approved", flagged: !hasGeo, flagReason: hasGeo ? undefined : "remote check-in without location" };
    }
    if (mode === "REMOTE") {
      return {
        allowed: false,
        method: "remote_approved",
        flagged: false,
        error:
          remote.status === "pending"
            ? "Remote day request is still pending approval"
            : "No approved remote day for today. Request one or check in at the office.",
      };
    }
    // HYBRID without approval falls through to onsite rules
  }

  if (mode === "FIELD") {
    return { allowed: true, method: "field", flagged: !hasGeo, flagReason: hasGeo ? undefined : "field check-in without location" };
  }

  // ONSITE (and unapproved HYBRID): QR token + geofence
  if (!qrToken) {
    return { allowed: false, method: "qr_geo", flagged: false, error: "Scan the office QR code to check in" };
  }

  const qr = await verifyQrToken(qrToken, tenantSlug);
  if (!qr.valid) {
    return { allowed: false, method: "qr_geo", flagged: false, error: qr.error || "Invalid QR code" };
  }

  const locRes = await db.query(
    `SELECT latitude, longitude, radius_m FROM attendance_locations WHERE id=$1 AND tenant_slug=$2`,
    [qr.locationId, tenantSlug]
  );
  const loc = locRes.rows[0];
  if (!loc) return { allowed: false, method: "qr_geo", flagged: false, error: "QR location not found" };

  if (!hasGeo) {
    return {
      allowed: true,
      method: "qr_geo",
      flagged: true,
      flagReason: "checked in via QR without device location",
      locationId: qr.locationId,
    };
  }

  const distance = haversineMeters(latitude!, longitude!, Number(loc.latitude), Number(loc.longitude));
  const radius = Number(loc.radius_m) || 500;
  const flagged = distance > radius || (typeof accuracyM === "number" && accuracyM > 100);

  return {
    allowed: true, // policy: allow + flag
    method: "qr_geo",
    flagged,
    flagReason: flagged
      ? distance > radius
        ? `checked in ${Math.round(distance)}m from ${qr.locationName ?? "office"} (limit ${radius}m)`
        : `low GPS accuracy (${Math.round(accuracyM ?? 0)}m)`
      : undefined,
    distanceM: Math.round(distance),
    locationId: qr.locationId,
  };
}
