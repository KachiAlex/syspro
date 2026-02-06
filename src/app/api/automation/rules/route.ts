import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { CreateRuleSchema, safeParse } from "@/lib/validation";
import { createAutomationRule, listAutomationRules } from "@/lib/automation/db";

export async function GET(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");
    const rules = await listAutomationRules(tenantSlug);
    return NextResponse.json({ rules });
  } catch (error) {
    console.error("Automation rules GET failed", error);
    const message = error instanceof Error ? error.message : "Unable to fetch rules";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "write");
    const body = await request.json().catch(() => ({}));
    const validation = safeParse(CreateRuleSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid rule", details: validation.error.flatten() }, { status: 400 });
    }

    const rule = await createAutomationRule({
      tenantSlug,
      name: validation.data.name,
      description: validation.data.description,
      eventType: validation.data.eventType,
      condition: validation.data.condition,
      actions: validation.data.actions,
      scope: validation.data.scope,
      enabled: validation.data.enabled,
      simulationOnly: validation.data.simulationOnly,
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error("Automation rule create failed", error);
    const message = error instanceof Error ? error.message : "Unable to create rule";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
