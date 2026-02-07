import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

let AUDIT_LOGS = [
  { id: "log-1", tenantSlug: "kreatix-default", actor: "admin@tenant.com", action: "user_created", resource: "user", timestamp: "2026-01-31T10:00:00Z", status: "success" },
  { id: "log-2", tenantSlug: "kreatix-default", actor: "admin@tenant.com", action: "role_updated", resource: "role", timestamp: "2026-01-30T14:30:00Z", status: "success" },
];

let MFA_SETTINGS = [
  { id: "mfa-1", tenantSlug: "kreatix-default", enforcement: "optional", methods: ["totp", "sms"], enforcedRoles: [] },
];

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug") ?? "kreatix-default";
    const limit = url.searchParams.get("limit") ?? "20";
    return NextResponse.json({
      auditLogs: AUDIT_LOGS.filter((l) => l.tenantSlug === tenantSlug).slice(0, parseInt(limit as string)),
      mfaSettings: MFA_SETTINGS.find((m) => m.tenantSlug === tenantSlug),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug") ?? "kreatix-default";
    const body = await request.json().catch(() => ({}));
    if (body.type === "audit_log") {
      const log = {
        id: `log-${randomUUID().slice(0, 6)}`,
        tenantSlug,
        actor: body.actor ?? "system",
        action: body.action ?? "unknown",
        resource: body.resource ?? "unknown",
        timestamp: new Date().toISOString(),
        status: "success",
      };
      AUDIT_LOGS = [log, ...AUDIT_LOGS];
      return NextResponse.json({ auditLog: log });
    }
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug") ?? "kreatix-default";
    const body = await request.json().catch(() => ({}));
    if (body.mfaUpdates) {
      MFA_SETTINGS = MFA_SETTINGS.map((m) => (m.tenantSlug === tenantSlug ? { ...m, ...body.mfaUpdates } : m));
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug") ?? "kreatix-default";
    const id = url.searchParams.get("id");
    const type = url.searchParams.get("type");
    if (type === "audit_log" && id) {
      AUDIT_LOGS = AUDIT_LOGS.filter((l) => !(l.id === id && l.tenantSlug === tenantSlug));
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
