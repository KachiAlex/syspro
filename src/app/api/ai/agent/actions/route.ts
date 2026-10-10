export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { executeAction, rejectAction } from "@/lib/ai/actions";
import { authenticateAgent } from "@/lib/ai/agent-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const actionSchema = z.object({
  actionId: z.string().min(1).max(100),
  reject: z.boolean().optional(),
});

/**
 * POST /api/ai/agent/actions
 * Confirm (or reject) a pending write action staged by propose_action.
 * Body: { actionId } → execute; { actionId, reject: true } → reject.
 * Permissions re-validated at execution time against the *confirming* actor.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;
  if (!auth) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body must include actionId" }, { status: 400 });
  }

  const ctx = {
    tenantSlug: auth.tenantSlug,
    actorId: auth.employeeId,
    actorRole: auth.employeeRole,
    authMethod: auth.authMethod,
  };

  const outcome = parsed.data.reject
    ? await rejectAction(parsed.data.actionId, ctx)
    : await executeAction(parsed.data.actionId, ctx);

  const status = outcome.status === "error" ? 400 : 200;
  return NextResponse.json(outcome, { status });
}
