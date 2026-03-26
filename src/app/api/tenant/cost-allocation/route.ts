import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

let COST_CENTERS = [
  { id: "cc-1", tenantSlug: "kreatix-default", code: "SALES-EMEA", name: "Sales - EMEA", region: "EMEA", budget: 500000, spent: 320000 },
  { id: "cc-2", tenantSlug: "kreatix-default", code: "OPS-APAC", name: "Operations - APAC", region: "APAC", budget: 350000, spent: 180000 },
];

let ALLOCATIONS = [
  { id: "alloc-1", tenantSlug: "kreatix-default", expenseId: "EXP-001", costCenterId: "cc-1", amount: 50000, percentage: 100 },
];

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug") ?? "kreatix-default";
    return NextResponse.json({
      costCenters: COST_CENTERS.filter((c) => c.tenantSlug === tenantSlug),
      allocations: ALLOCATIONS.filter((a) => a.tenantSlug === tenantSlug),
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
    if (body.type === "cost_center") {
      const cc = {
        id: `cc-${randomUUID().slice(0, 6)}`,
        tenantSlug,
        code: body.code ?? "UNKNOWN",
        name: body.name ?? "Cost Center",
        region: body.region ?? "Global",
        budget: body.budget ?? 0,
        spent: 0,
      };
      COST_CENTERS = [cc, ...COST_CENTERS];
      return NextResponse.json({ costCenter: cc });
    }
    if (body.type === "allocation") {
      const alloc = {
        id: `alloc-${randomUUID().slice(0, 6)}`,
        tenantSlug,
        expenseId: body.expenseId ?? "unknown",
        costCenterId: body.costCenterId ?? "unknown",
        amount: body.amount ?? 0,
        percentage: body.percentage ?? 100,
      };
      ALLOCATIONS = [alloc, ...ALLOCATIONS];
      return NextResponse.json({ allocation: alloc });
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
    if (body.costCenterId) {
      COST_CENTERS = COST_CENTERS.map((c) => (c.id === body.costCenterId && c.tenantSlug === tenantSlug ? { ...c, ...body.updates } : c));
      return NextResponse.json({ success: true });
    }
    if (body.allocationId) {
      ALLOCATIONS = ALLOCATIONS.map((a) => (a.id === body.allocationId && a.tenantSlug === tenantSlug ? { ...a, ...body.updates } : a));
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
    if (type === "cost_center" && id) {
      COST_CENTERS = COST_CENTERS.filter((c) => !(c.id === id && c.tenantSlug === tenantSlug));
      return NextResponse.json({ success: true });
    }
    if (type === "allocation" && id) {
      ALLOCATIONS = ALLOCATIONS.filter((a) => !(a.id === id && a.tenantSlug === tenantSlug));
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
