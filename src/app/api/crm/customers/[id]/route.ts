import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateCustomer, listCustomers, countCustomers } from "@/lib/crm/db";
import { handleDatabaseError } from "@/lib/api-errors";
import { db } from "@/lib/sql-client";

const patchSchema = z.object({
  tenantSlug: z.string().min(1),
  name: z.string().min(1).optional(),
  status: z.string().optional(),
  primaryContact: z.record(z.unknown()).optional(),
});

async function getCustomerById(id: string) {
  const rows = (await db.query(`select * from crm_customers where id = $1 limit 1`, [id])).rows;
  return rows.length ? rows[0] : null;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await getCustomerById(id);
  if (!existing || existing.tenant_slug !== parsed.data.tenantSlug) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  try {
    const customer = await updateCustomer(id, {
      name: parsed.data.name,
      status: parsed.data.status,
      primaryContact: parsed.data.primaryContact,
    });
    return NextResponse.json({ customer });
  } catch (error) {
    return handleDatabaseError(error, "Customer update");
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  if (!tenantSlug) return NextResponse.json({ error: "tenantSlug required" }, { status: 400 });

  const existing = await getCustomerById(id);
  if (!existing || existing.tenant_slug !== tenantSlug) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  try {
    await db.query(`delete from crm_customers where id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleDatabaseError(error, "Customer deletion");
  }
}
