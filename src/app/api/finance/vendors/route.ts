export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  lookupVendor,
  listVendors,
  getVendor,
  getVendorStats,
  createVendor,
  updateVendor,
  deleteVendor,
} from "@/lib/finance/vendors";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

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
  // Enforce tenant context for vendor listing
  const context = validateTenantContext(request, "read");
  const _gate = await requireModuleAccess(request, "finance", "read");
  if (!_gate.ok) return _gate.response;
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

    const result = await lookupVendor(context.tenantSlug, query, type || "name");
    return NextResponse.json(result);
  }

  // Stats endpoint: /api/finance/vendors?stats=true
  if (url.searchParams.get("stats") === "true") {
    const stats = await getVendorStats(context.tenantSlug);
    return NextResponse.json({ stats });
  }

  // List endpoint: /api/finance/vendors
  const parsed = vendorListSchema.safeParse({
    isActive: url.searchParams.has("isActive") ? url.searchParams.get("isActive") : undefined,
    paymentTerms: url.searchParams.has("paymentTerms") ? url.searchParams.get("paymentTerms") : undefined,
    country: url.searchParams.has("country") ? url.searchParams.get("country") : undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

    const page = parseInt(url.searchParams.get("page") ?? "1");
    const pageSize = parseInt(url.searchParams.get("limit") ?? url.searchParams.get("pageSize") ?? "50");

    try {
      const allVendors = await listVendors({ ...parsed.data, tenantSlug: context.tenantSlug });
      const total = allVendors.length;
      const start = (page - 1) * pageSize;
      const vendors = allVendors.slice(start, start + pageSize);
      return NextResponse.json({
        vendors,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
      });
    } catch (error) {
      console.error("Vendor list failed:", (error as any)?.stack || error);
      return NextResponse.json({ error: "Failed to list vendors", details: String((error as any)?.message ?? error) }, { status: 500 });
    }
  } catch (err) {
    console.error('API GET /api/finance/vendors top-level error:', (err as any)?.stack || err);
    return NextResponse.json({ error: 'Internal error', details: String((err as any)?.message ?? err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Require write permission for creating or fetching vendor details
  const context = validateTenantContext(request, "write");
  const _gate = await requireModuleAccess(request, "finance", "write");
  if (!_gate.ok) return _gate.response;
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Get vendor by ID endpoint
  if (body.vendorId) {
    try {
      const vendor = await getVendor(body.vendorId, context.tenantSlug);
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
      const vendor = await createVendor({ ...parsed.data, tenantSlug: context.tenantSlug });
      return NextResponse.json({ vendor }, { status: 201 });
    }
  } catch (error) {
    console.error("Create vendor failed:", error);
    return NextResponse.json({ error: "Failed to create vendor" }, { status: 500 });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

const BANK_FIELDS = ["accountNumber", "bankCode", "bankName"] as const;

export async function PUT(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const _gate = await requireModuleAccess(request, "finance", "write");
  if (!_gate.ok) return _gate.response;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Vendor ID is required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const updateSchema = z.object({
      name: z.string().min(1).optional(),
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

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Bank detail changes route through the approval engine — payment
    // diversion via edited beneficiary accounts is the classic AP fraud.
    // Non-bank fields still apply immediately.
    const bankChanges: Record<string, string | undefined> = {};
    const nonBank: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if ((BANK_FIELDS as readonly string[]).includes(key)) bankChanges[key] = value as string | undefined;
      else nonBank[key] = value;
    }

    const current = await getVendor(id, context.tenantSlug);
    if (!current) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const changed = BANK_FIELDS.filter(
      (f) => bankChanges[f] !== undefined && String(bankChanges[f] ?? "") !== String((current as any)[f] ?? "")
    );

    let vendor = Object.keys(nonBank).length
      ? await updateVendor(id, nonBank, context.tenantSlug)
      : current;
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    if (changed.length > 0) {
      const staged: Record<string, string | undefined> = {};
      for (const f of changed) staged[f] = bankChanges[f];
      const { gateOrRun } = await import("@/lib/finance/gated-actions");
      const outcome = await gateOrRun(
        context.tenantSlug,
        "vendor_bank_change",
        { vendorId: id, vendorName: vendor.name ?? current.name, bankChanges: staged },
        { requestedBy: _gate.user.id ?? "unknown" }
      );
      if (outcome.status === "pending") {
        return NextResponse.json({
          vendor,
          bankChangePendingApproval: true,
          approvalId: outcome.approvalId,
        }, { status: 202 });
      }
      if (outcome.status === "denied") {
        return NextResponse.json({ error: outcome.error }, { status: 403 });
      }
      vendor = outcome.result ?? vendor;
    }

    return NextResponse.json({ vendor });
  } catch (error) {
    console.error("Update vendor failed:", error);
    return NextResponse.json({ error: "Failed to update vendor" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const context = validateTenantContext(request, "delete");
  const _gate = await requireModuleAccess(request, "finance", "write");
  if (!_gate.ok) return _gate.response;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Vendor ID is required" }, { status: 400 });
  }

  try {
    const deleted = await deleteVendor(id, context.tenantSlug);
    if (!deleted) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete vendor failed:", error);
    return NextResponse.json({ error: "Failed to delete vendor" }, { status: 500 });
  }
}
