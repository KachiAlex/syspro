import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractAuthContext, requirePermission, validateTenant } from "@/lib/auth-helper";
import { deleteOrgAdmin, listOrgAdmins, upsertOrgAdmin } from "@/lib/org-admins";
import { ORG_NODE_TYPES } from "@/lib/org-tree";

const scopeEnum = z.enum(["global", "continent", "region", "country", "state", "branch", "department", "team"]);

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  nodeId: z.string().min(1),
  userEmail: z.string().email(),
  displayName: z.string().min(1).optional().nullable(),
  role: z.string().min(1).optional().nullable(),
  scope: scopeEnum,
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

const deleteSchema = z.object({ id: z.string().uuid(), tenantSlug: z.string().optional() });

export async function GET(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "read");

    const url = new URL(request.url);
    const nodeId = url.searchParams.get("nodeId") || undefined;
    const admins = await listOrgAdmins(tenantSlug, nodeId || undefined);
    return NextResponse.json({ admins, tenantSlug });
  } catch (error) {
    console.error("Org admins GET failed", error);
    const message = error instanceof Error ? error.message : "Unable to fetch org admins";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "write");

    const body = await request.json().catch(() => ({}));
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }

    if (!ORG_NODE_TYPES.includes("branch") && parsed.data.scope === "branch") {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }

    const admin = await upsertOrgAdmin({
      ...parsed.data,
      tenantSlug,
    });
    return NextResponse.json({ admin }, { status: parsed.data.id ? 200 : 201 });
  } catch (error) {
    console.error("Org admin upsert failed", error);
    const message = error instanceof Error ? error.message : "Unable to save org admin";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = extractAuthContext(request);
    const tenantSlug = validateTenant(auth.tenantSlug);
    requirePermission(auth.userRole, "admin");

    const body = await request.json().catch(() => ({}));
    const parsed = deleteSchema.safeParse({ ...body, tenantSlug });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }

    await deleteOrgAdmin(parsed.data.id, tenantSlug);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Org admin delete failed", error);
    const message = error instanceof Error ? error.message : "Unable to delete org admin";
    return NextResponse.json({ error: message }, { status: message.includes("Unauthorized") ? 403 : 500 });
  }
}
