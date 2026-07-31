import { NextResponse } from 'next/server';
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import {
  getTaskById,
  createTaskAssignment,
  getAssignmentsForTask,
  removeTaskAssignment,
  getHODsForEmployees,
} from "@/lib/projects/db";
import { insertNotification } from "@/lib/hr/db";

function toClientAssignment(row: any) {
  return {
    id: row.id,
    taskId: row.task_id,
    projectId: row.project_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name ?? "Unknown",
    employeeEmail: row.employee_email ?? "",
    departmentId: row.employee_department_id ?? null,
    departmentName: row.employee_department_name ?? "",
    status: row.status,
    assignedHours: row.assigned_hours ?? null,
    assignmentStartDate: row.assignment_start_date,
    createdAt: row.created_at,
  };
}

// GET current assignments for a task
export async function GET(
  request: Request,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const context = validateTenantContext(request as any, "read");
    const rows = await getAssignmentsForTask(params.taskId, context.tenantSlug);
    return NextResponse.json({ assignments: rows.map(toClientAssignment) });
  } catch (error) {
    console.error('Failed to fetch task assignments:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch task assignments';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: assign one or more employees to a task.
// Any staff member may be assigned regardless of department — this
// endpoint performs no department-based filtering or restriction.
export async function POST(
  request: Request,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const context = validateTenantContext(request as any, "write");
    const body = await request.json();
    const employeeIds: string[] = Array.isArray(body.employeeIds)
      ? body.employeeIds.filter((v: any) => typeof v === "string" && v.length > 0)
      : [];

    if (employeeIds.length === 0) {
      return NextResponse.json({ error: "employeeIds is required" }, { status: 400 });
    }

    const task = await getTaskById(params.taskId, context.tenantSlug);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const assignmentStartDate = body.assignmentStartDate
      ? new Date(body.assignmentStartDate)
      : new Date();

    const existing = await getAssignmentsForTask(params.taskId, context.tenantSlug);
    const alreadyAssigned = new Set(existing.map((a: any) => a.employee_id));

    const created = [];
    for (const employeeId of employeeIds) {
      if (alreadyAssigned.has(employeeId)) continue;
      const assignment = await createTaskAssignment(
        context.tenantSlug,
        {
          taskId: params.taskId,
          projectId: params.id,
          employeeId,
          assignedHours: body.assignedHours ?? undefined,
          assignmentStartDate,
          status: "ACCEPTED",
        } as any,
        context.userId
      );
      if (assignment) created.push(assignment);
    }

    // Auto-tag HODs: notify each unique HOD whose department member was assigned
    if (created.length > 0) {
      try {
        const hodMap = await getHODsForEmployees(employeeIds, context.tenantSlug);
        const notifiedHODs = new Set<string>();
        for (const empId of employeeIds) {
          const hod = hodMap.get(empId);
          if (hod && !notifiedHODs.has(hod.hodId)) {
            notifiedHODs.add(hod.hodId);
            await insertNotification({
              tenantSlug: context.tenantSlug,
              employeeId: hod.hodId,
              type: 'info',
              category: 'projects',
              title: 'Task Assigned to Your Department Member',
              message: `Task "${task.title}" has been assigned to an employee in your department (${hod.departmentName}).`,
              actionUrl: `/tenant-admin/projects/tasks`,
            });
          }
        }
      } catch (notifErr) {
        console.error('Failed to notify HODs:', notifErr);
      }
    }

    const assignments = await getAssignmentsForTask(params.taskId, context.tenantSlug);
    return NextResponse.json(
      {
        assignments: assignments.map(toClientAssignment),
        created: created.length,
        message: `${created.length} employee(s) assigned successfully`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to assign task:', error);
    const message = error instanceof Error ? error.message : 'Failed to assign task';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: remove a single assignment
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const context = validateTenantContext(request as any, "write");
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get("assignmentId");

    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });
    }

    const removed = await removeTaskAssignment(assignmentId, context.tenantSlug);
    if (!removed) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const assignments = await getAssignmentsForTask(params.taskId, context.tenantSlug);
    return NextResponse.json({
      assignments: assignments.map(toClientAssignment),
      message: "Assignment removed",
    });
  } catch (error) {
    console.error('Failed to remove task assignment:', error);
    const message = error instanceof Error ? error.message : 'Failed to remove task assignment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
