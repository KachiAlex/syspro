export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql as SQL } from "@/lib/sql-client";
import { insertEmployee, ensureHrTables } from "@/lib/hr/db";
import {
  ensureRecruitmentTables,
  getCandidateById,
  listApplications,
  listOffers,
  insertOnboardingTask,
} from "@/lib/hr/db-recruitment";
import { setEmployeePassword, generatePassword } from "@/lib/hr/auth";
import { requireModuleAccess } from "@/lib/api-auth";

const hireSchema = z.object({
  tenantSlug: z.string().min(1),
  departmentId: z.string().min(1).optional(),
  jobTitle: z.string().min(1).optional(),
  salary: z.number().nonnegative().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reportingManagerId: z.string().optional(),
  employmentType: z.enum(["full-time", "part-time", "contract", "intern"]).optional(),
  activatePortal: z.boolean().optional(),
  password: z.string().min(1).optional(),
});

const DEFAULT_ONBOARDING: { category: string; task: string; dueInDays: number }[] = [
  { category: "hr", task: "Complete personal information & emergency contact forms", dueInDays: 3 },
  { category: "hr", task: "Sign employment contract and policy acknowledgements", dueInDays: 3 },
  { category: "it", task: "Provision email account and system access", dueInDays: 1 },
  { category: "it", task: "Issue laptop and required equipment", dueInDays: 5 },
  { category: "admin", task: "Add to payroll and benefits enrollment", dueInDays: 7 },
  { category: "manager", task: "Schedule orientation and team introduction", dueInDays: 2 },
  { category: "manager", task: "Assign 30/60/90-day goals", dueInDays: 14 },
  { category: "compliance", task: "Complete mandatory compliance training", dueInDays: 14 },
];

/**
 * POST /api/hr/candidates/[id]/hire
 * Converts a candidate (typically with an accepted offer) into an employee:
 * creates the admin_employees record, moves the candidate to 'hired', marks
 * linked applications offer_accepted, and seeds a default onboarding
 * checklist. Optionally activates portal access.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scope = await requireModuleAccess(request, "people", "write");
  if (!scope.ok) return scope.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const parsed = hireSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { tenantSlug } = parsed.data;

  try {
    await ensureHrTables(SQL);
    await ensureRecruitmentTables(SQL);

    const candidate = await getCandidateById(id, tenantSlug);
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }
    if (candidate.currentStage === "hired") {
      return NextResponse.json({ error: "Candidate has already been hired" }, { status: 409 });
    }
    if (candidate.currentStage === "rejected") {
      return NextResponse.json({ error: "Cannot hire a rejected candidate" }, { status: 409 });
    }

    // Pull defaults from the candidate's latest application + accepted offer
    const applications = await listApplications({ tenantSlug, candidateId: id, limit: 10 });
    const application = applications[0] ?? null;
    const offers = application ? await listOffers({ tenantSlug, applicationId: application.id, limit: 10 }) : [];
    const acceptedOffer = offers.find((o: any) => o.status === "accepted") ?? offers[0] ?? null;

    let requisitionDefaults: { departmentId?: string; jobTitle?: string; employmentType?: string } = {};
    if (application) {
      const reqs = await SQL`
        select department_id, title, employment_type from admin_job_requisitions
        where id = ${application.requisitionId} and tenant_slug = ${tenantSlug} limit 1
      `;
      const req = (reqs as any[])[0];
      if (req) {
        requisitionDefaults = {
          departmentId: req.department_id,
          jobTitle: req.title,
          employmentType: req.employment_type,
        };
      }
    }

    const departmentId = parsed.data.departmentId ?? requisitionDefaults.departmentId;
    const jobTitle = parsed.data.jobTitle ?? requisitionDefaults.jobTitle;
    if (!departmentId || !jobTitle) {
      return NextResponse.json(
        { error: "departmentId and jobTitle are required (no requisition defaults found)" },
        { status: 400 }
      );
    }

    const startDate =
      parsed.data.startDate ??
      (acceptedOffer?.startDate
        ? new Date(acceptedOffer.startDate).toISOString().split("T")[0]
        : null);

    let employee;
    try {
      employee = await insertEmployee({
        tenantSlug,
        name: candidate.fullName,
        email: candidate.email,
        phone: candidate.phone ?? null,
        departmentId,
        jobTitle,
        reportingManagerId:
          parsed.data.reportingManagerId ?? acceptedOffer?.reportingManagerId ?? null,
        hireDate: startDate ? `${startDate}T00:00:00.000Z` : null,
        salary:
          parsed.data.salary ??
          (acceptedOffer?.salary != null ? Number(acceptedOffer.salary) : null),
        employmentType:
          parsed.data.employmentType ?? requisitionDefaults.employmentType ?? "full-time",
        status: "active",
        createdBy: scope.user.id,
      });
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.includes("already exists") || msg.includes("HOD role")) {
        return NextResponse.json({ error: msg }, { status: 409 });
      }
      throw err;
    }

    // Move the candidate and linked applications to hired/offer_accepted
    await SQL`
      update admin_candidates set current_stage = 'hired', updated_at = now()
      where id = ${id} and tenant_slug = ${tenantSlug}
    `;
    for (const app of applications) {
      if (app.status !== "withdrew" && app.status !== "offer_rejected") {
        await SQL`
          update admin_applications set status = 'offer_accepted', decided_at = now(), updated_at = now()
          where id = ${app.id} and tenant_slug = ${tenantSlug}
        `;
      }
    }

    // Seed the default onboarding checklist for the new employee
    const today = new Date();
    for (const t of DEFAULT_ONBOARDING) {
      const due = new Date(today.getTime() + t.dueInDays * 86400000).toISOString().split("T")[0];
      try {
        await insertOnboardingTask({
          tenantSlug,
          employeeId: employee.id,
          category: t.category,
          task: t.task,
          assignedToUserId: scope.user.id,
          dueDate: due,
        });
      } catch (e) {
        console.error("Onboarding task seed failed:", t.task, (e as any)?.message);
      }
    }

    // Optional portal activation
    let portalCredentials: { email: string; password: string } | null = null;
    if (parsed.data.activatePortal) {
      const password = parsed.data.password || generatePassword();
      await setEmployeePassword(tenantSlug, employee.id, password);
      portalCredentials = { email: employee.email, password };
    }

    return NextResponse.json(
      { success: true, employee, onboardingTasksSeeded: DEFAULT_ONBOARDING.length, portalCredentials },
      { status: 201 }
    );
  } catch (error) {
    console.error("Candidate hire failed", error);
    return NextResponse.json({ error: "Failed to hire candidate" }, { status: 500 });
  }
}
