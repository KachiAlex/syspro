export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  applySlaStatusTransition,
  createWarrantyClaim,
  detectSlaBreaches,
  listWarrantyClaims,
  recalcTicketSla,
  updateSlaPolicy,
  updateWarrantyClaim,
} from "@/lib/support/sla-engine";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "admin", "read");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") ?? "warranty-claims";

    switch (view) {
      case "warranty-claims":
        return NextResponse.json({ claims: await listWarrantyClaims(context.tenantSlug, searchParams.get("status") ?? undefined) });
      default:
        return NextResponse.json({ error: "view must be warranty-claims" }, { status: 400 });
    }
  } catch (error) {
    console.error("SLA engine read failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "admin", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();

    switch (body.action) {
      case "update-policy":
        await updateSlaPolicy({
          tenantSlug: context.tenantSlug, policyId: String(body.policyId),
          serviceDays: body.serviceDays, businessStart: body.businessStart,
          businessEnd: body.businessEnd, pauseOnStatuses: body.pauseOnStatuses,
          fulfilOnStatuses: body.fulfilOnStatuses,
        });
        return NextResponse.json({ ok: true });
      case "recalc-ticket":
        return NextResponse.json(await recalcTicketSla(context.tenantSlug, String(body.ticketId)));
      case "status-transition":
        return NextResponse.json(await applySlaStatusTransition(context.tenantSlug, String(body.ticketId), String(body.status)));
      case "detect-breaches":
        return NextResponse.json(await detectSlaBreaches(context.tenantSlug));
      case "create-warranty-claim":
        return NextResponse.json({ claim: await createWarrantyClaim({
          tenantSlug: context.tenantSlug, serialNo: body.serialNo, productSku: body.productSku,
          customerId: body.customerId, customerName: body.customerName,
          warrantyExpiry: body.warrantyExpiry, complaint: String(body.complaint),
          createdBy: context.userId,
        }) }, { status: 201 });
      case "update-warranty-claim":
        return NextResponse.json({ claim: await updateWarrantyClaim({
          tenantSlug: context.tenantSlug, claimId: String(body.claimId),
          status: body.status, resolution: body.resolution, ticketId: body.ticketId,
        }) });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const code = /not found/i.test(msg) ? 404 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
