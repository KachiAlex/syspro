import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

let CONNECTORS = [
  { id: "conn-1", tenantSlug: "kreatix-default", name: "Stripe", enabled: true },
  { id: "conn-2", tenantSlug: "kreatix-default", name: "QuickBooks", enabled: false },
];

let API_KEYS = [
  { id: "key-1", tenantSlug: "kreatix-default", label: "Admin key", key: "sk_live_12345", revoked: false },
];

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug") ?? "kreatix-default";
    return NextResponse.json({ connectors: CONNECTORS.filter((c) => c.tenantSlug === tenantSlug), apiKeys: API_KEYS.filter((k) => k.tenantSlug === tenantSlug) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug") ?? "kreatix-default";
    const body = await request.json().catch(() => ({}));
    if (body.type === "connector") {
      const connector = { id: `conn-${randomUUID().slice(0,6)}`, tenantSlug, name: body.name ?? "Unknown", enabled: !!body.enabled };
      CONNECTORS = [connector, ...CONNECTORS];
      return NextResponse.json({ connector });
    }
    if (body.type === "apikey") {
      const key = { id: `key-${randomUUID().slice(0,6)}`, tenantSlug, label: body.label ?? "key", key: `sk_dev_${randomUUID().slice(0,12)}`, revoked: false };
      API_KEYS = [key, ...API_KEYS];
      return NextResponse.json({ apiKey: key });
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
    if (body.connectorId) {
      CONNECTORS = CONNECTORS.map((c) => (c.id === body.connectorId && c.tenantSlug === tenantSlug ? { ...c, ...body.updates } : c));
      return NextResponse.json({ success: true });
    }
    if (body.apiKeyId) {
      API_KEYS = API_KEYS.map((k) => (k.id === body.apiKeyId && k.tenantSlug === tenantSlug ? { ...k, ...body.updates } : k));
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
    if (type === "connector" && id) {
      CONNECTORS = CONNECTORS.filter((c) => !(c.id === id && c.tenantSlug === tenantSlug));
      return NextResponse.json({ success: true });
    }
    if (type === "apikey" && id) {
      API_KEYS = API_KEYS.map((k) => (k.id === id && k.tenantSlug === tenantSlug ? { ...k, revoked: true } : k));
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
