import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { createTaskAssignment, getTaskById } from "@/lib/projects/db";
import { suggestAssignments } from "@/lib/project-fit";

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const {
    taskId,
    requiredSkills,
    department,
    override,
    employeeId,
  } = body as {
    taskId?: string;
    requiredSkills?: string[];
    department?: string;
    override?: { employeeId: string; reason: string; approvedBy?: string };
    employeeId?: string;
  };

  if (!taskId || !requiredSkills || requiredSkills.length === 0 || !department) {
    return NextResponse.json(
      { error: "taskId, department, and requiredSkills are required" },
      { status: 400 }
    );
  }

  const suggestions = suggestAssignments({ tenantSlug: context.tenantSlug, department, requiredSkills });

  let assignmentRecord = null;
  const assignedEmployeeId = override?.employeeId ?? employeeId;
  if (assignedEmployeeId) {
    const task = await getTaskById(taskId, context.tenantSlug);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    assignmentRecord = await createTaskAssignment(
      context.tenantSlug,
      {
        taskId,
        projectId: task.projectId,
        employeeId: assignedEmployeeId,
        assignedHours: undefined,
        assignedPercentage: undefined,
        assignmentStartDate: new Date(),
        status: override ? "ACCEPTED" : "PROPOSED",
      },
      context.userId
    );
  }

  return NextResponse.json({ suggestions, assignment: assignmentRecord });
}
