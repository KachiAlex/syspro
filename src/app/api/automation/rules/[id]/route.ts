import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { UpdateRuleSchema, safeParse } from "@/lib/validation";
import { deleteAutomationRule, getAutomationRule, updateAutomationRule } from "@/lib/automation/db";

export async function PATCH(request: NextRequest, context: any) {
  const { params } = context;
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "write");
    const body = await request.json().catch(() => ({}));
    const validation = safeParse(UpdateRuleSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid rule update", details: validation.error.flatten() }, { status: 400 });
    }

    const updated = await updateAutomationRule(params.id, tenantSlug, validation.data);
    if (!updated) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    return NextResponse.json({ rule: updated });
  } catch (error) {
    console.error("Automation rule update failed", error);
    const message = error instanceof Error ? error.message : "Unable to update rule";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}

export async function DELETE(request: NextRequest, context: any) {
  const { params } = context;
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "delete");
    const existing = await getAutomationRule(params.id, tenantSlug);
    if (!existing) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    await deleteAutomationRule(params.id, tenantSlug);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Automation rule delete failed", error);
    const message = error instanceof Error ? error.message : "Unable to delete rule";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
