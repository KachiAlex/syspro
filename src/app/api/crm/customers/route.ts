import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { insertCustomer, listCustomers } from "@/lib/crm/db";

const customerSchema = z.object({
  tenantSlug: z.string().min(1),
  regionId: z.string().min(1),
  branchId: z.string().min(1),
  name: z.string().min(2),
  contactFirstName: z.string().min(1, "First name required"),
  contactLastName: z.string().min(1, "Last name required"),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(7, "Phone number required"),
  status: z.string().optional(),
});

const customerListSchema = z.object({
  tenantSlug: z.string().min(1),
  regionId: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = customerListSchema.safeParse({
    tenantSlug: url.searchParams.get("tenantSlug") ?? "kreatix-default",
    regionId: url.searchParams.get("regionId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const customers = await listCustomers({
      tenantSlug: parsed.data.tenantSlug,
      regionId: parsed.data.regionId,
      limit: parsed.data.limit,
    });
    return NextResponse.json({ customers });
  } catch (error) {
    console.error("Customer list failed", error);
    return NextResponse.json({ error: "Failed to load customers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const customer = await insertCustomer({
      tenantSlug: parsed.data.tenantSlug,
      regionId: parsed.data.regionId,
      branchId: parsed.data.branchId,
      name: parsed.data.name,
      primaryContact: {
        name: `${parsed.data.contactFirstName} ${parsed.data.contactLastName}`.trim(),
        firstName: parsed.data.contactFirstName,
        lastName: parsed.data.contactLastName,
        email: parsed.data.contactEmail,
        phone: parsed.data.contactPhone,
      },
      status: parsed.data.status,
    });
    return NextResponse.json({ customer });
  } catch (error) {
    console.error("Customer creation failed", error);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
