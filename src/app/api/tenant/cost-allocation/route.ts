import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/sql-client";
import { validateTenantContext } from "@/lib/tenant-admin/utils";

async function ensureTables() {
  await db.query(`
    create table if not exists finance_cost_centers (
      id text primary key,
      tenant_slug text not null,
      code text not null,
      name text not null,
      region text,
      budget numeric default 0,
      spent numeric default 0,
      created_at timestamptz default now()
    )
  `);
  await db.query(`
    create table if not exists finance_allocations (
      id text primary key,
      tenant_slug text not null,
      expense_id text not null,
      cost_center_id text not null references finance_cost_centers(id),
      amount numeric default 0,
      percentage numeric default 100,
      created_at timestamptz default now()
    )
  `);
}

export async function GET(request: Request) {
  try {
    const context = validateTenantContext(request as any, "read");
    await ensureTables();
    const tenantSlug = context.tenantSlug;
    const costCenters = (await db.query(
      `select * from finance_cost_centers where tenant_slug = $1 order by created_at desc`,
      [tenantSlug]
    )).rows;
    const allocations = (await db.query(
      `select * from finance_allocations where tenant_slug = $1 order by created_at desc`,
      [tenantSlug]
    )).rows;
    return NextResponse.json({ costCenters, allocations });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = validateTenantContext(request as any, "write");
    await ensureTables();
    const tenantSlug = context.tenantSlug;
    const body = await request.json().catch(() => ({}));
    if (body.type === "cost_center") {
      const id = `cc-${randomUUID().slice(0, 6)}`;
      const cc = {
        id,
        tenant_slug: tenantSlug,
        code: body.code ?? "UNKNOWN",
        name: body.name ?? "Cost Center",
        region: body.region ?? "Global",
        budget: body.budget ?? 0,
        spent: 0,
      };
      await db.query(
        `insert into finance_cost_centers (id, tenant_slug, code, name, region, budget, spent) values ($1, $2, $3, $4, $5, $6, $7)`,
        [cc.id, cc.tenant_slug, cc.code, cc.name, cc.region, cc.budget, cc.spent]
      );
      return NextResponse.json({ costCenter: cc });
    }
    if (body.type === "allocation") {
      const id = `alloc-${randomUUID().slice(0, 6)}`;
      const alloc = {
        id,
        tenant_slug: tenantSlug,
        expense_id: body.expenseId ?? "unknown",
        cost_center_id: body.costCenterId ?? "unknown",
        amount: body.amount ?? 0,
        percentage: body.percentage ?? 100,
      };
      await db.query(
        `insert into finance_allocations (id, tenant_slug, expense_id, cost_center_id, amount, percentage) values ($1, $2, $3, $4, $5, $6)`,
        [alloc.id, alloc.tenant_slug, alloc.expense_id, alloc.cost_center_id, alloc.amount, alloc.percentage]
      );
      return NextResponse.json({ allocation: alloc });
    }
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const context = validateTenantContext(request as any, "write");
    await ensureTables();
    const tenantSlug = context.tenantSlug;
    const body = await request.json().catch(() => ({}));
    if (body.costCenterId) {
      await db.query(
        `update finance_cost_centers set code = coalesce($1, code), name = coalesce($2, name), region = coalesce($3, region), budget = coalesce($4, budget), spent = coalesce($5, spent) where id = $6 and tenant_slug = $7`,
        [body.updates?.code, body.updates?.name, body.updates?.region, body.updates?.budget, body.updates?.spent, body.costCenterId, tenantSlug]
      );
      return NextResponse.json({ success: true });
    }
    if (body.allocationId) {
      await db.query(
        `update finance_allocations set expense_id = coalesce($1, expense_id), cost_center_id = coalesce($2, cost_center_id), amount = coalesce($3, amount), percentage = coalesce($4, percentage) where id = $5 and tenant_slug = $6`,
        [body.updates?.expenseId, body.updates?.costCenterId, body.updates?.amount, body.updates?.percentage, body.allocationId, tenantSlug]
      );
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const context = validateTenantContext(request as any, "delete");
    await ensureTables();
    const tenantSlug = context.tenantSlug;
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const type = url.searchParams.get("type");
    if (type === "cost_center" && id) {
      await db.query(`delete from finance_cost_centers where id = $1 and tenant_slug = $2`, [id, tenantSlug]);
      return NextResponse.json({ success: true });
    }
    if (type === "allocation" && id) {
      await db.query(`delete from finance_allocations where id = $1 and tenant_slug = $2`, [id, tenantSlug]);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
