import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  lookupVendor,
  listVendors,
  getVendor,
  getVendorStats,
  createVendor,
} from "@/lib/finance/vendors";

const vendorSearchSchema = z.object({
  query: z.string().min(1),
  type: z.enum(["name", "code", "email"]).default("name"),
});

const vendorListSchema = z.object({
  isActive: z.coerce.boolean().optional(),
  paymentTerms: z.string().optional(),
  country: z.string().optional(),
});

export async function GET(request: NextRequest) {
  console.log('API: GET /api/finance/vendors called');
  try {
  const url = new URL(request.url);

  // Search endpoint: /api/finance/vendors?search=true&query=...
  if (url.searchParams.get("search") === "true") {
    const query = url.searchParams.get("query");
    const type = url.searchParams.get("type") as "name" | "code" | "email" | undefined;

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter required" },
        { status: 400 }
      );
    }

    const result = await lookupVendor(query, type || "name");
    return NextResponse.json(result);
  }

  // Stats endpoint: /api/finance/vendors?stats=true
  if (url.searchParams.get("stats") === "true") {
    const stats = await getVendorStats();
    return NextResponse.json({ stats });
  }

  // List endpoint: /api/finance/vendors
  const parsed = vendorListSchema.safeParse({
    isActive: url.searchParams.get("isActive"),
    paymentTerms: url.searchParams.get("paymentTerms"),
    country: url.searchParams.get("country"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

    try {
      const vendors = await listVendors(parsed.data);
      return NextResponse.json({ vendors });
    } catch (error) {
      console.error("Vendor list failed:", (error as any)?.stack || error);
      return NextResponse.json({ error: "Failed to list vendors", details: String((error as any)?.message || error) }, { status: 500 });
    }
  } catch (err) {
    console.error('API GET /api/finance/vendors top-level error:', (err as any)?.stack || err);
    return NextResponse.json({ error: 'Internal error', details: String((err as any)?.message || err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Get vendor by ID endpoint
  if (body.vendorId) {
    try {
      const vendor = await getVendor(body.vendorId);
      if (!vendor) {
        return NextResponse.json(
          { error: "Vendor not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ vendor });
    } catch (error) {
      console.error("Get vendor failed:", error);
      return NextResponse.json(
        { error: "Failed to get vendor" },
        { status: 500 }
      );
    }
  }

  // Create vendor endpoint
  try {
    const createSchema = z.object({
      name: z.string().min(1),
      code: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      taxId: z.string().optional(),
      accountNumber: z.string().optional(),
      bankCode: z.string().optional(),
      bankName: z.string().optional(),
      paymentTerms: z.enum(["net30", "net60", "net90", "immediate", "cod"]).optional(),
      isActive: z.coerce.boolean().optional(),
    });

    const parsed = createSchema.safeParse(body);
    if (parsed.success) {
      const vendor = await createVendor(parsed.data as any);
      return NextResponse.json({ vendor }, { status: 201 });
    }
  } catch (error) {
    console.error("Create vendor failed:", error);
    return NextResponse.json({ error: "Failed to create vendor" }, { status: 500 });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
