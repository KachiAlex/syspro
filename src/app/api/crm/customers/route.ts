import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { insertCustomer, listCustomers, countCustomers } from "@/lib/crm/db";
import { resolveCrmAuth } from "@/lib/crm/auth";
import { handleDatabaseError } from "@/lib/api-errors";

const customerSchema = z.object({
  tenantSlug: z.string().min(1),
  regionId: z.string().optional().default("default"),
  branchId: z.string().optional().default("default"),
  name: z.string().min(1),
  contactFirstName: z.string().optional().default(""),
  contactLastName: z.string().optional().default(""),
  contactEmail: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  contactPhone: z.union([z.string(), z.literal(""), z.null()]).optional(),
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
    tenantSlug: url.searchParams.get("tenantSlug"),
    regionId: url.searchParams.get("regionId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const auth = await resolveCrmAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (auth.session.tenantSlug !== parsed.data.tenantSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const customers = await listCustomers({
      tenantSlug: parsed.data.tenantSlug,
      regionId: parsed.data.regionId,
      limit: parsed.data.limit,
    });
    const total = await countCustomers({ tenantSlug: parsed.data.tenantSlug, regionId: parsed.data.regionId });
    return NextResponse.json({ customers, total });
  } catch (error) {
    return handleDatabaseError(error, "Customer list");
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

  const auth = await resolveCrmAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (auth.session.tenantSlug !== parsed.data.tenantSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
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
    return handleDatabaseError(error, "Customer creation");
  }
}
