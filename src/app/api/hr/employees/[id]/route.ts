export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateEmployee, deleteEmployee, getEmployeeById, resolveOrCreateDepartment, employeeDependencies } from "@/lib/hr/db";
import { requireModuleAccess, requireDocAccess } from "@/lib/api-auth";

const updateSchema = z.object({
  tenantSlug: z.string().optional(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  departmentId: z.string().min(1).optional(),
  departmentName: z.string().optional(),
  jobTitle: z.string().min(1).optional(),
  reportingManagerId: z.string().optional(),
  branchId: z.string().optional(),
  regionId: z.string().optional(),
  costCenter: z.string().optional(),
  hireDate: z.string().datetime().optional(),
  salary: z.number().nonnegative().optional(),
  employmentType: z.enum(["full-time", "part-time", "contract", "intern"]).optional(),
  workMode: z.enum(["ONSITE", "REMOTE", "HYBRID", "FIELD"]).optional(),
  status: z.enum(["active", "inactive", "on-leave", "terminated"]).optional(),
  role: z.enum(["staff", "hod", "admin", "executive"]).optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountName: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireModuleAccess(request, "people", "read");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const tenantSlug = auth.user.tenantSlug ?? new URL(request.url).searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  try {
    const employee = await getEmployeeById(id, tenantSlug);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    return NextResponse.json({ employee });
  } catch (error) {
    console.error("Employee get failed", error);
    return NextResponse.json({ error: "Failed to load employee" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireDocAccess(request, "employee", "edit", "people", "write");
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Override tenantSlug with the authenticated session's tenant
  const parsed = updateSchema.safeParse({ ...body, tenantSlug: auth.user.tenantSlug ?? body.tenantSlug });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    // Resolve departmentName to departmentId if provided
    let updateData = { ...parsed.data };
    if (!updateData.departmentId && updateData.departmentName && updateData.tenantSlug) {
      const dept = await resolveOrCreateDepartment(updateData.tenantSlug, updateData.departmentName);
      updateData.departmentId = dept.id;
    }
    delete (updateData as any).departmentName;
    delete (updateData as any).tenantSlug;

    // Salary changes are authority decisions — the new value is staged in
    // pending_salary and routed through the approval workflow instead of
    // being applied directly.
    let salaryPending: { previousSalary: number | null; newSalary: number } | null = null;
    if (updateData.salary !== undefined && parsed.data.tenantSlug) {
      const { sql } = await import("@/lib/sql-client");
      await sql`alter table admin_employees add column if not exists pending_salary numeric`;
      const [emp] = await sql`
        select salary, pending_salary, name, department_id
        from admin_employees
        where id = ${id} and tenant_slug = ${parsed.data.tenantSlug}
        limit 1
      ` as any[];
      if (!emp) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 });
      }
      const newSalary = Number(updateData.salary);
      const previousSalary = emp.salary == null ? null : Number(emp.salary);
      if (previousSalary !== newSalary) {
        if (emp.pending_salary != null) {
          return NextResponse.json(
            { error: `A salary change to ${emp.pending_salary} is already awaiting approval for this employee` },
            { status: 409 }
          );
        }
        await sql`
          update admin_employees set pending_salary = ${newSalary}
          where id = ${id} and tenant_slug = ${parsed.data.tenantSlug}
        `;
        delete updateData.salary;
        try {
          const { initiateApproval } = await import("@/lib/finance/approvals");
          await initiateApproval({
            tenantSlug: parsed.data.tenantSlug,
            entityType: "employee_salary_change",
            entityId: id,
            requestedBy: auth.user.id,
            entityData: {
              amount: newSalary,
              previousAmount: previousSalary,
              departmentId: emp.department_id,
              reference: `Salary change — ${emp.name ?? id}`,
              requestedByName: auth.user.id,
            },
          });
        } catch (approvalErr) {
          // Roll the staging back if the workflow could not be created —
          // otherwise the change hangs invisible.
          await sql`update admin_employees set pending_salary = null where id = ${id}`;
          throw approvalErr;
        }
        salaryPending = { previousSalary, newSalary };
      } else {
        delete updateData.salary; // no-op change — don't touch the row
      }
    }

    // Employee bank-detail edits are the payroll-side equivalent of vendor
    // bank fraud — staged as pending_bank_details and routed through the
    // approvals engine. Other fields still apply immediately.
    const BANK_FIELDS = ["bankName", "bankAccountNumber", "bankAccountName"] as const;
    const bankChanges: Record<string, string | undefined> = {};
    for (const f of BANK_FIELDS) {
      if (updateData[f] !== undefined) {
        bankChanges[f] = updateData[f] as string | undefined;
        delete updateData[f];
      }
    }
    let bankChangePending: { approvalId: string } | null = null;
    if (Object.keys(bankChanges).length > 0 && parsed.data.tenantSlug) {
      const { sql } = await import("@/lib/sql-client");
      await sql`alter table admin_employees add column if not exists pending_bank_details jsonb`;
      const [emp] = await sql`
        select bank_name, bank_account_number, bank_account_name,
               pending_bank_details, name
        from admin_employees
        where id = ${id} and tenant_slug = ${parsed.data.tenantSlug}
        limit 1
      ` as any[];
      if (!emp) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 });
      }
      if (emp.pending_bank_details) {
        return NextResponse.json(
          { error: "A bank-detail change is already awaiting approval for this employee" },
          { status: 409 }
        );
      }
      const current: Record<string, any> = {
        bankName: emp.bank_name,
        bankAccountNumber: emp.bank_account_number,
        bankAccountName: emp.bank_account_name,
      };
      const changed = Object.entries(bankChanges).filter(
        ([k, v]) => String(v ?? "") !== String(current[k] ?? "")
      );
      if (changed.length > 0) {
        const { gateOrRun } = await import("@/lib/finance/gated-actions");
        const outcome = await gateOrRun(
          parsed.data.tenantSlug,
          "employee_bank_change",
          {
            employeeId: id,
            employeeName: emp.name,
            bankChanges: Object.fromEntries(changed),
          },
          { requestedBy: auth.user.id }
        );
        if (outcome.status === "pending") {
          bankChangePending = { approvalId: outcome.approvalId };
        } else if (outcome.status === "denied") {
          return NextResponse.json({ error: outcome.error }, { status: 403 });
        }
      }
    }

    // Termination is an authority decision — route it through the approvals
    // engine (people domain). Other fields still apply immediately.
    let terminationPending: { approvalId: string } | null = null;
    if (updateData.status === "terminated" && parsed.data.tenantSlug) {
      delete updateData.status;
      const { gateOrRun } = await import("@/lib/finance/gated-actions");
      const [empRow] = await (await import("@/lib/sql-client")).sql`
        select name, department_id from admin_employees
        where id = ${id} and tenant_slug = ${parsed.data.tenantSlug} limit 1
      ` as any[];
      const outcome = await gateOrRun(
        parsed.data.tenantSlug,
        "employee_termination",
        { employeeId: id, employeeName: empRow?.name },
        { requestedBy: auth.user.id, departmentId: empRow?.department_id ?? undefined }
      );
      if (outcome.status === "pending") {
        terminationPending = { approvalId: outcome.approvalId };
      } else if (outcome.status === "denied") {
        return NextResponse.json({ error: outcome.error }, { status: 403 });
      }
    }

    // A salary/termination-only request leaves updateData empty — skip the
    // update call and refetch.
    const employee = Object.keys(updateData).length
      ? await updateEmployee(id, updateData, parsed.data.tenantSlug, auth.user.id)
      : await getEmployeeById(id, parsed.data.tenantSlug!);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    return NextResponse.json({
      employee,
      salaryPendingApproval: salaryPending,
      terminationPendingApproval: terminationPending,
      bankChangePendingApproval: bankChangePending,
    });
  } catch (error: any) {
    console.error("Employee update failed", error);
    const msg = error?.message || "";
    if (msg.includes("HOD role in this department")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    if (msg.includes("Invalid status transition") || msg.includes("Invalid employee status")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireDocAccess(request, "employee", "delete", "people", "write");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const tenantSlug = auth.user.tenantSlug ?? new URL(request.url).searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  try {
    const deps = await employeeDependencies(id, tenantSlug);
    const total = Object.values(deps).reduce((a, b) => a + b, 0);
    const force = new URL(request.url).searchParams.get("force") === "true";
    if (total > 0 && !force) {
      return NextResponse.json(
        {
          error: "Employee has historical records — deleting would erase payroll/leave/attendance history. Start offboarding instead, or pass force=true to delete anyway.",
          dependencies: deps,
        },
        { status: 409 }
      );
    }
    // Deleting an employee erases history — always routed through the
    // approvals engine unless a people-matrix band auto-approves.
    const { gateOrRun } = await import("@/lib/finance/gated-actions");
    const outcome = await gateOrRun(
      tenantSlug,
      "employee_delete",
      { employeeId: id },
      { requestedBy: auth.user.id }
    );
    if (outcome.status === "pending") {
      return NextResponse.json({ success: true, pendingApproval: true, approvalId: outcome.approvalId }, { status: 202 });
    }
    if (outcome.status === "denied") {
      return NextResponse.json({ error: outcome.error }, { status: 403 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Employee delete failed", error);
    return NextResponse.json({ error: "Failed to delete employee" }, { status: 500 });
  }
}
