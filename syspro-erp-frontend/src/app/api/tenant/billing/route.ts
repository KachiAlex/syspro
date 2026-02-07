import { NextResponse, NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { enforcePermission } from "@/lib/api-permission-enforcer";

let INVOICES = [
  { id: "INV-1001", tenantSlug: "kreatix-default", amount: "₦48,200", dueDate: "2026-02-05", status: "pending" },
  { id: "INV-1002", tenantSlug: "kreatix-default", amount: "₦12,400", dueDate: "2026-01-15", status: "paid" },
];

let SUBSCRIPTIONS = [
  { id: "SUB-01", tenantSlug: "kreatix-default", plan: "Business", status: "active", nextBillingDate: "2026-02-28", seats: 12 },
];

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug") ?? "kreatix-default";
    
    // Enforce read permission on billing module
    const check = await enforcePermission(request, "billing", "read", tenantSlug);
    if (!check.allowed) {
      return check.response;
    }

    const payload = {
      invoices: INVOICES.filter((i) => i.tenantSlug === tenantSlug),
      subscriptions: SUBSCRIPTIONS.filter((s) => s.tenantSlug === tenantSlug),
    };
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug") ?? "kreatix-default";
    
    // Enforce write permission on billing module
    const check = await enforcePermission(request, "billing", "write", tenantSlug);
    if (!check.allowed) {
      return check.response;
    }

    const body = await request.json().catch(() => ({}));
    if (body.type === "invoice") {
      const invoice = { id: `INV-${randomUUID().slice(0,8)}`, tenantSlug, amount: body.amount ?? "₦0", dueDate: body.dueDate ?? new Date().toISOString(), status: body.status ?? "pending" };
      INVOICES = [invoice, ...INVOICES];
      return NextResponse.json({ invoice });
    }
    if (body.type === "subscription") {
      const sub = { id: `SUB-${randomUUID().slice(0,6)}`, tenantSlug, plan: body.plan ?? "Free", status: body.status ?? "active", nextBillingDate: body.nextBillingDate ?? null, seats: body.seats ?? 1 };
      SUBSCRIPTIONS = [sub, ...SUBSCRIPTIONS];
      return NextResponse.json({ subscription: sub });
    }
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug") ?? "kreatix-default";
    
    // Enforce write permission on billing module
    const check = await enforcePermission(request, "billing", "write", tenantSlug);
    if (!check.allowed) {
      return check.response;
    }

    const body = await request.json().catch(() => ({}));
    if (body.invoiceId) {
      INVOICES = INVOICES.map((inv) => (inv.id === body.invoiceId && inv.tenantSlug === tenantSlug ? { ...inv, ...body.updates } : inv));
      return NextResponse.json({ success: true });
    }
    if (body.subscriptionId) {
      SUBSCRIPTIONS = SUBSCRIPTIONS.map((s) => (s.id === body.subscriptionId && s.tenantSlug === tenantSlug ? { ...s, ...body.updates } : s));
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug") ?? "kreatix-default";
    
    // Enforce write permission on billing module
    const check = await enforcePermission(request, "billing", "write", tenantSlug);
    if (!check.allowed) {
      return check.response;
    }

    const id = url.searchParams.get("id");
    const type = url.searchParams.get("type");
    if (type === "invoice" && id) {
      INVOICES = INVOICES.filter((inv) => !(inv.id === id && inv.tenantSlug === tenantSlug));
      return NextResponse.json({ success: true });
    }
    if (type === "subscription" && id) {
      SUBSCRIPTIONS = SUBSCRIPTIONS.map((s) => (s.id === id && s.tenantSlug === tenantSlug ? { ...s, status: "cancelled" } : s));
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
