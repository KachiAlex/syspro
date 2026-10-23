export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  addAdvanceTax, createPartyLink, deletePartyLink, getContraPartners,
  listAdvanceTaxes, listPartyLinks, removeAdvanceTax,
} from "@/lib/finance/edge";
import { applyMatches, suggestMatches } from "@/lib/finance/bank-reconciliation";
import { bisectLedger } from "@/lib/finance/bisect";
import { listPostingSettings, setPostingAccount } from "@/lib/finance/posting-settings";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    switch (searchParams.get("view") ?? "party-links") {
      case "party-links":
        return NextResponse.json({ links: await listPartyLinks(context.tenantSlug, searchParams.get("partyType") ?? undefined, searchParams.get("partyId") ?? undefined) });
      case "contra":
        return NextResponse.json({ partners: await getContraPartners(context.tenantSlug) });
      case "advance-taxes":
        return NextResponse.json({ taxes: await listAdvanceTaxes(context.tenantSlug, searchParams.get("paymentId") ?? undefined) });
      case "bisect":
        return NextResponse.json(await bisectLedger({
          tenantSlug: context.tenantSlug,
          accountCode: String(searchParams.get("account") ?? ""),
          expectedClosing: Number(searchParams.get("expected") ?? 0),
          openingBalance: searchParams.get("opening") ? Number(searchParams.get("opening")) : undefined,
          dateFrom: searchParams.get("from") ?? undefined,
          dateTo: searchParams.get("to") ?? undefined,
        }));
      case "posting-settings":
        return NextResponse.json({ settings: await listPostingSettings(context.tenantSlug) });
      default:
        return NextResponse.json({ error: "view must be party-links|contra|advance-taxes|bisect|posting-settings" }, { status: 400 });
    }
  } catch (error) {
    console.error("Finance edge read failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    switch (body.action) {
      case "create-link":
        return NextResponse.json({ link: await createPartyLink({
          tenantSlug: context.tenantSlug, primaryType: String(body.primaryType),
          primaryId: String(body.primaryId), secondaryType: String(body.secondaryType),
          secondaryId: String(body.secondaryId), createdBy: context.userId,
        }) }, { status: 201 });
      case "delete-link":
        await deletePartyLink(context.tenantSlug, String(body.id));
        return NextResponse.json({ ok: true });
      case "add-advance-tax":
        return NextResponse.json({ tax: await addAdvanceTax({
          tenantSlug: context.tenantSlug, paymentId: String(body.paymentId),
          taxCode: String(body.taxCode), description: body.description,
          rate: Number(body.rate ?? 0), taxAmount: Number(body.taxAmount),
          accountCode: body.accountCode,
        }) }, { status: 201 });
      case "remove-advance-tax":
        await removeAdvanceTax(context.tenantSlug, String(body.id));
        return NextResponse.json({ ok: true });
      case "suggest-matches":
        return NextResponse.json({ proposals: await suggestMatches(context.tenantSlug, String(body.reconciliationId), body.dayWindow) });
      case "apply-matches":
        return NextResponse.json(await applyMatches(body.pairs ?? []));
      case "set-posting-account":
        return NextResponse.json(await setPostingAccount(context.tenantSlug, String(body.key), String(body.accountCode)));
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: /Invalid|cannot|must|not found/i.test(msg) ? 400 : 500 });
  }
}
