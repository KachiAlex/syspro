export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  getOpenCustomerInvoices,
  getUnallocatedCustomerPayments,
  getOpenBills,
  getUnappliedVendorPayments,
  applyCustomerPaymentToInvoice,
  applyVendorPaymentToBill,
} from "@/lib/finance/payment-reconciliation";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantSlug = searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }
    const partyType = searchParams.get("partyType") === "supplier" ? "supplier" : "customer";
    const partyId = searchParams.get("partyId") ?? undefined;

    const [documents, payments] = partyType === "customer"
      ? await Promise.all([
          getOpenCustomerInvoices(tenantSlug, partyId),
          getUnallocatedCustomerPayments(tenantSlug, partyId),
        ])
      : await Promise.all([
          getOpenBills(tenantSlug, partyId),
          getUnappliedVendorPayments(tenantSlug, partyId),
        ]);

    return NextResponse.json({ success: true, data: { partyType, documents, payments } });
  } catch (error) {
    console.error("Error loading reconciliation data:", error);
    return NextResponse.json(
      { success: false, error: (error as any)?.message ?? "Internal server error" },
      { status: (error as any)?.status ?? 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "write");
  if (!_scope.ok) return _scope.response;

  try {
    const body = await request.json();
    const { tenantSlug, partyType, allocations } = body ?? {};
    if (!tenantSlug || !Array.isArray(allocations) || allocations.length === 0) {
      return NextResponse.json(
        { success: false, error: "tenantSlug and a non-empty allocations array are required" },
        { status: 400 },
      );
    }

    const results: any[] = [];
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < allocations.length; i++) {
      const a = allocations[i];
      try {
        if (partyType === "supplier") {
          await applyVendorPaymentToBill({
            tenantSlug,
            paymentId: a.paymentId,
            billId: a.documentId,
            amount: Number(a.amount),
          });
          results.push({ billId: a.documentId, applied: Number(a.amount) });
        } else {
          const r = await applyCustomerPaymentToInvoice({
            tenantSlug,
            paymentId: a.paymentId,
            invoiceId: a.documentId,
            amount: Number(a.amount),
          });
          results.push(r);
        }
      } catch (err: any) {
        errors.push({ index: i, error: err?.message ?? "Allocation failed" });
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      data: { applied: results, errors },
    }, { status: errors.length && !results.length ? 400 : 200 });
  } catch (error) {
    console.error("Error reconciling payments:", error);
    return NextResponse.json(
      { success: false, error: (error as any)?.message ?? "Internal server error" },
      { status: (error as any)?.status ?? 500 },
    );
  }
}
