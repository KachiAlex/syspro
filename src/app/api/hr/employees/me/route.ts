import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken } from "@/lib/hr/auth";
import { getEmployeeById } from "@/lib/hr/db";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("employee_session")?.value;

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const session = decodeEmployeeToken(token);
  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  try {
    const employee = await getEmployeeById(session.id, session.tenantSlug);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Fetch raw row for personal info columns not in normalizeEmployeeRow
    let raw: any = {};
    try {
      const rows = await SQL`select * from admin_employees where id = ${session.id} and tenant_slug = ${session.tenantSlug} limit 1`;
      raw = (rows as any[])[0] || {};
    } catch (e) { console.error("me: raw fetch failed:", (e as any)?.message); }

    return NextResponse.json({
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        jobTitle: employee.jobTitle,
        role: employee.role,
        departmentId: employee.departmentId,
        employmentType: employee.employmentType,
        status: employee.status,
        hireDate: employee.hireDate,
        salary: employee.salary,
        lastLogin: employee.lastLogin,
        phone: raw.phone ?? null,
        address: raw.address ?? null,
        maritalStatus: raw.marital_status ?? null,
        profilePicture: raw.profile_picture ?? null,
        gender: raw.gender ?? null,
        dateOfBirth: raw.date_of_birth ?? null,
        emergencyContactName: raw.emergency_contact_name ?? null,
        emergencyContactPhone: raw.emergency_contact_phone ?? null,
        nationality: raw.nationality ?? null,
        stateOfOrigin: raw.state_of_origin ?? null,
        city: raw.city ?? null,
        portalPermissions: raw.portal_permissions ?? null,
      },
    });
  } catch (error) {
    console.error("Employee /me error:", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).nullable().optional(),
  gender: z.enum(["male", "female", "other"]).nullable().optional(),
  dateOfBirth: z.string().max(20).nullable().optional(),
  emergencyContactName: z.string().max(100).nullable().optional(),
  emergencyContactPhone: z.string().max(50).nullable().optional(),
  nationality: z.string().max(100).nullable().optional(),
  stateOfOrigin: z.string().max(100).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  profilePicture: z.string().nullable().optional(),
});

/**
 * PATCH /api/hr/employees/me
 * Employee updates their own personal information.
 */
export async function PATCH(request: NextRequest) {
  const token = request.cookies.get("employee_session")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const session = decodeEmployeeToken(token);
  if (!session) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    try { await ensureHrTables(SQL); } catch (e) { console.error("ensureHrTables failed:", (e as any)?.message); }

    const d = parsed.data;
    const updated = await SQL`
      update admin_employees set
        name = coalesce(${d.name ?? null}, name),
        phone = coalesce(${d.phone ?? null}, phone),
        address = coalesce(${d.address ?? null}, address),
        marital_status = coalesce(${d.maritalStatus ?? null}, marital_status),
        gender = coalesce(${d.gender ?? null}, gender),
        date_of_birth = coalesce(${d.dateOfBirth ?? null}, date_of_birth),
        emergency_contact_name = coalesce(${d.emergencyContactName ?? null}, emergency_contact_name),
        emergency_contact_phone = coalesce(${d.emergencyContactPhone ?? null}, emergency_contact_phone),
        nationality = coalesce(${d.nationality ?? null}, nationality),
        state_of_origin = coalesce(${d.stateOfOrigin ?? null}, state_of_origin),
        city = coalesce(${d.city ?? null}, city),
        profile_picture = coalesce(${d.profilePicture ?? null}, profile_picture),
        updated_at = now()
      where id = ${session.id} and tenant_slug = ${session.tenantSlug}
      returning *
    `;

    const rows = updated as any[];
    if (rows.length === 0) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const row = rows[0];
    return NextResponse.json({
      success: true,
      employee: {
        id: row.id,
        name: row.name,
        email: row.email,
        jobTitle: row.job_title,
        role: row.role,
        departmentId: row.department_id,
        employmentType: row.employment_type,
        status: row.status,
        hireDate: row.hire_date,
        salary: row.salary,
        lastLogin: row.last_login,
        phone: row.phone ?? null,
        address: row.address ?? null,
        maritalStatus: row.marital_status ?? null,
        profilePicture: row.profile_picture ?? null,
        gender: row.gender ?? null,
        dateOfBirth: row.date_of_birth ?? null,
        emergencyContactName: row.emergency_contact_name ?? null,
        emergencyContactPhone: row.emergency_contact_phone ?? null,
        nationality: row.nationality ?? null,
        stateOfOrigin: row.state_of_origin ?? null,
        city: row.city ?? null,
        portalPermissions: row.portal_permissions ?? null,
      },
    });
  } catch (error: any) {
    console.error("Employee /me PATCH error:", error?.message);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
