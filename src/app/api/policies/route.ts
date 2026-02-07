import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { CreatePolicySchema, safeParse } from "@/lib/validation";
import { createPolicy, listPolicies } from "@/lib/policy/db";

export async function GET(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");
    const policies = await listPolicies(tenantSlug);
    return NextResponse.json({ policies });
  } catch (error) {
    console.error("Policies GET failed", error);
    const message = error instanceof Error ? error.message : "Unable to fetch policies";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "write");
    const body = await request.json().catch(() => ({}));
    const validation = safeParse(CreatePolicySchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid policy", details: validation.error.flatten() }, { status: 400 });
    }

    const policy = await createPolicy({
      tenantSlug,
      key: validation.data.key,
      name: validation.data.name,
      category: validation.data.category,
      scope: validation.data.scope,
      document: validation.data.document,
      effectiveAt: validation.data.effectiveAt,
    });

    return NextResponse.json({ policy }, { status: 201 });
  } catch (error) {
    console.error("Policy create failed", error);
    const message = error instanceof Error ? error.message : "Unable to create policy";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
