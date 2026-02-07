import { NextRequest, NextResponse } from "next/server";

import { recordAssignment } from "@/lib/projects-data";
import { suggestAssignments } from "@/lib/project-fit";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    tenantSlug = "default",
    taskId,
    requiredSkills,
    department,
    override,
    employeeId,
  } = body as {
    tenantSlug?: string;
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

  const suggestions = suggestAssignments({ tenantSlug, department, requiredSkills });

  let assignmentRecord = null;
  if (override && override.employeeId) {
    assignmentRecord = recordAssignment(tenantSlug, {
      taskId,
      employeeId: override.employeeId,
      fitScore: suggestions.find((s) => s.employeeId === override.employeeId)?.fitScore ?? 0,
      overrideReason: override.reason,
      approvedBy: override.approvedBy,
    });
  } else if (employeeId) {
    assignmentRecord = recordAssignment(tenantSlug, {
      taskId,
      employeeId,
      fitScore: suggestions.find((s) => s.employeeId === employeeId)?.fitScore ?? 0,
    });
  }

  return NextResponse.json({ suggestions, assignment: assignmentRecord });
}
