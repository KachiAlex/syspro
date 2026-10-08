export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { requireModuleAccess } from "@/lib/api-auth";
import { fetchPendingActions, markActionStatus } from "@/lib/automation/db";
import { handleAutomationAction } from "@/lib/automation/connectors";
import { processQueuedReportJobs } from "@/lib/reporting/jobs";

export async function POST(request: NextRequest) {
  const scope = await requireModuleAccess(request, "automation", "write");
  if (!scope.ok) return scope.response;

  const auth = extractAuthContext(request);
  const tenantSlug = validateTenant(auth.tenantSlug);

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 1, 1), 50) : 25;

  try {
    const maxAttempts = 3;
    const actions = await fetchPendingActions(limit, tenantSlug, maxAttempts);
    const actionResults = [] as Array<{ id: string; status: string; error?: string }>;
    for (const action of actions) {
      await markActionStatus(action.id, "processing", null);
      const result = await handleAutomationAction(action as any);
      await markActionStatus(action.id, result.status, result.error || null);
      actionResults.push({ id: action.id, status: result.status, error: result.error });
    }

    const reportResults = await processQueuedReportJobs(limit, tenantSlug);

    return NextResponse.json({ actions: actionResults, reports: reportResults });
  } catch (error) {
    console.error("Automation queue processing failed", error);
    const message = error instanceof Error ? error.message : "Unable to process queue";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
