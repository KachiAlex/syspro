import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { PolicyOverrideSchema, UpdatePolicySchema, safeParse } from "@/lib/validation";
import { addPolicyOverride, addPolicyVersion, getPolicyWithVersions, updatePolicyStatus } from "@/lib/policy/db";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "write");
    const body = await request.json().catch(() => ({}));
    const validation = safeParse(UpdatePolicySchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid policy update", details: validation.error.flatten() }, { status: 400 });
    }

    const policy = await getPolicyWithVersions(params.id, tenantSlug);
    if (!policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 });

    if (validation.data.status) {
      await updatePolicyStatus(params.id, validation.data.status as any);
    }

    if (validation.data.document) {
      const nextVersion = (policy.versions?.[0]?.version || 0) + 1;
      await addPolicyVersion(params.id, nextVersion, validation.data.document, validation.data.effectiveAt);
    }

    const updated = await getPolicyWithVersions(params.id, tenantSlug);
    return NextResponse.json({ policy: updated });
  } catch (error) {
    console.error("Policy update failed", error);
    const message = error instanceof Error ? error.message : "Unable to update policy";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  // POST here handles overrides creation
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "write");
    const body = await request.json().catch(() => ({}));
    const validation = safeParse(PolicyOverrideSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid override", details: validation.error.flatten() }, { status: 400 });
    }

    const policy = await getPolicyWithVersions(params.id, tenantSlug);
    if (!policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 });

    await addPolicyOverride({ policyId: params.id, tenantSlug, scope: validation.data.scope, reason: validation.data.reason, createdBy: validation.data.createdBy });
    const updated = await getPolicyWithVersions(params.id, tenantSlug);
    return NextResponse.json({ policy: updated }, { status: 201 });
  } catch (error) {
    console.error("Policy override failed", error);
    const message = error instanceof Error ? error.message : "Unable to add override";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
