import { NextRequest, NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";
import { z } from "zod";
import { randomUUID } from "crypto";

const createRequisitionSchema = z.object({
  tenantSlug: z.string().min(1),
  items: z.array(z.object({
    componentSku: z.string().min(1),
    componentName: z.string().min(1),
    quantity: z.coerce.number().positive(),
    unit: z.string().default("pcs"),
    unitCost: z.coerce.number().min(0).default(0),
    notes: z.string().optional(),
  })).min(1),
  notes: z.string().optional(),
  source: z.string().default("manual"),
  requestedBy: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }

    const sql = SQL;
    await ensureRequisitionTables(sql);

    const status = request.nextUrl.searchParams.get("status");
    const page = parseInt(request.nextUrl.searchParams.get("page") ?? "1");
    const pageSize = parseInt(request.nextUrl.searchParams.get("pageSize") ?? "50");
    const offset = (page - 1) * pageSize;

    const [countRow] = (await (status
      ? sql`select count(*)::int as total from procurement_requisitions where tenant_slug = ${tenantSlug} and status = ${status}`
      : sql`select count(*)::int as total from procurement_requisitions where tenant_slug = ${tenantSlug}`
    )) as any[];

    const total = countRow?.total ?? 0;

    const rows = status
      ? (await sql`select * from procurement_requisitions where tenant_slug = ${tenantSlug} and status = ${status} order by created_at desc limit ${pageSize} offset ${offset}`)
      : (await sql`select * from procurement_requisitions where tenant_slug = ${tenantSlug} order by created_at desc limit ${pageSize} offset ${offset}`);

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (error) {
    console.error("Error fetching requisitions:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createRequisitionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
    }

    const sql = SQL;
    await ensureRequisitionTables(sql);

    const id = randomUUID();
    const now = new Date();
    const reqNumber = `PR-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${id.slice(0, 6).toUpperCase()}`;
    const totalAmount = parsed.data.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

    const [row] = (await sql`
      insert into procurement_requisitions (
        id, tenant_slug, requisition_number, items, total_amount, status,
        source, notes, requested_by, created_at, updated_at
      )
      values (
        ${id}, ${parsed.data.tenantSlug}, ${reqNumber},
        ${JSON.stringify(parsed.data.items)}::jsonb,
        ${totalAmount}, 'pending',
        ${parsed.data.source}, ${parsed.data.notes ?? null},
        ${parsed.data.requestedBy ?? null}, ${now}, ${now}
      )
      returning *
    `) as any[];

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (error) {
    console.error("Error creating requisition:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
    const id = request.nextUrl.searchParams.get("id");
    const action = request.nextUrl.searchParams.get("action");

    if (!tenantSlug || !id) {
      return NextResponse.json({ success: false, error: "tenantSlug and id are required" }, { status: 400 });
    }

    const sql = SQL;
    await ensureRequisitionTables(sql);

    if (action === "approve") {
      const [row] = (await sql`
        update procurement_requisitions
        set status = 'approved', updated_at = now()
        where id = ${id} and tenant_slug = ${tenantSlug} and status = 'pending'
        returning *
      `) as any[];
      return NextResponse.json({ success: !!row, data: row });
    }

    if (action === "reject") {
      const [row] = (await sql`
        update procurement_requisitions
        set status = 'rejected', updated_at = now()
        where id = ${id} and tenant_slug = ${tenantSlug} and status = 'pending'
        returning *
      `) as any[];
      return NextResponse.json({ success: !!row, data: row });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating requisition:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

async function ensureRequisitionTables(sql: any) {
  await sql`
    create table if not exists procurement_requisitions (
      id text primary key,
      tenant_slug text not null,
      requisition_number text not null,
      items jsonb not null,
      total_amount numeric not null default 0,
      status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'converted')),
      source text not null default 'manual',
      notes text,
      requested_by text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists procurement_requisitions_tenant_idx on procurement_requisitions (tenant_slug, status)`;
}
