import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getVendor, updateVendor, deleteVendor, createVendor } from "@/lib/finance/vendors";

import { requireModuleAccess } from "@/lib/api-auth";
const vendorUpdateSchema = z.object({
  name: z.string().min(1).optional(),
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
  paymentTerms: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

/** Superadmin sessions carry no tenant — skip the tenant match for them. */
function tenantMatches(userTenant: string | undefined, recordTenant: string | undefined | null) {
  if (!userTenant) return true;
  return recordTenant === userTenant;
}

export async function GET(request: NextRequest, context: any) {
  const scope = await requireModuleAccess(request, "finance", "read");
  if (!scope.ok) return scope.response;

  const { params } = context;
  const { id } = await params;
  try {
    const vendor = await getVendor(id);
    if (!vendor || !tenantMatches(scope.user.tenantSlug, vendor.tenantSlug)) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    return NextResponse.json({ vendor });
  } catch (err) {
    console.error("Get vendor failed:", err);
    return NextResponse.json({ error: "Failed to get vendor" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: any) {
  const scope = await requireModuleAccess(request, "finance", "write");
  if (!scope.ok) return scope.response;

  const { params } = context;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = vendorUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

    try {
      // Verify the record belongs to the caller's tenant before mutating
      const existing = await getVendor(id);
      if (existing && !tenantMatches(scope.user.tenantSlug, existing.tenantSlug)) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }
      const updated = await updateVendor(id, parsed.data as any);
      if (!updated) {
        // If update couldn't find the vendor, create it from the provided data
        try {
          const created = await createVendor({ id, tenantSlug: scope.user.tenantSlug, ...(parsed.data as any) });
          return NextResponse.json({ vendor: created }, { status: 201 });
        } catch (e) {
          return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
        }
      }
      return NextResponse.json({ vendor: updated });
    } catch (err) {
      console.error("Update vendor failed:", err);
      return NextResponse.json({ error: "Failed to update vendor" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, context: any) {
  const scope = await requireModuleAccess(request, "finance", "write");
  if (!scope.ok) return scope.response;

  const { params } = context;
  const { id } = await params;
  try {
    const existing = await getVendor(id);
    if (!existing || !tenantMatches(scope.user.tenantSlug, existing.tenantSlug)) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    const ok = await deleteVendor(id);
    if (!ok) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete vendor failed:", err);
    return NextResponse.json({ error: "Failed to delete vendor" }, { status: 500 });
  }
}
