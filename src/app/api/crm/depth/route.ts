export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  contractsExpiringWithin,
  convertProspect,
  createContract,
  createProspect,
  enrollRecipient,
  listCampaigns,
  listContracts,
  listContractTemplates,
  listProspects,
  listSalesStages,
  processCampaignSends,
  setCampaignStatus,
  updateContractStatus,
  updateFulfilment,
  upsertCampaign,
  upsertContractTemplate,
  upsertSalesStage,
  weightedPipeline,
} from "@/lib/crm/depth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "crm", "read");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") ?? "prospects";

    switch (view) {
      case "prospects":
        return NextResponse.json({ prospects: await listProspects(context.tenantSlug, searchParams.get("status") ?? undefined) });
      case "contracts":
        return NextResponse.json({ contracts: await listContracts(context.tenantSlug, searchParams.get("status") ?? undefined) });
      case "contract-templates":
        return NextResponse.json({ templates: await listContractTemplates(context.tenantSlug) });
      case "contracts-expiring":
        return NextResponse.json({ contracts: await contractsExpiringWithin(context.tenantSlug, Number(searchParams.get("days") ?? 30)) });
      case "sales-stages":
        return NextResponse.json({ stages: await listSalesStages(context.tenantSlug) });
      case "weighted-pipeline":
        return NextResponse.json(await weightedPipeline(context.tenantSlug));
      case "campaigns":
        return NextResponse.json({ campaigns: await listCampaigns(context.tenantSlug) });
      default:
        return NextResponse.json({ error: "view must be prospects|contracts|contract-templates|contracts-expiring|sales-stages|weighted-pipeline|campaigns" }, { status: 400 });
    }
  } catch (error) {
    console.error("CRM depth read failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "crm", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();

    switch (body.action) {
      case "create-prospect":
        return NextResponse.json({ prospect: await createProspect({
          tenantSlug: context.tenantSlug, name: String(body.name),
          companyName: body.companyName, email: body.email, phone: body.phone,
          industry: body.industry, marketSegment: body.marketSegment,
          website: body.website, notes: body.notes, createdBy: context.userId,
        }) }, { status: 201 });
      case "convert-prospect":
        return NextResponse.json(await convertProspect(context.tenantSlug, String(body.prospectId)));
      case "upsert-contract-template":
        return NextResponse.json({ template: await upsertContractTemplate({
          tenantSlug: context.tenantSlug, name: String(body.name), body: String(body.body),
          fulfilmentTerms: body.fulfilmentTerms,
        }) });
      case "create-contract":
        return NextResponse.json({ contract: await createContract({
          tenantSlug: context.tenantSlug, templateId: body.templateId ?? null,
          customerId: String(body.customerId), customerName: String(body.customerName),
          dealId: body.dealId ?? null, projectId: body.projectId ?? null,
          startDate: body.startDate, endDate: body.endDate,
          contractValue: body.contractValue != null ? Number(body.contractValue) : undefined,
          currency: body.currency, body: body.body, createdBy: context.userId,
        }) }, { status: 201 });
      case "contract-status":
        return NextResponse.json({ contract: await updateContractStatus(context.tenantSlug, String(body.contractId), body.status) });
      case "contract-fulfilment":
        return NextResponse.json(await updateFulfilment(context.tenantSlug, String(body.contractId), Number(body.termIndex), Boolean(body.fulfilled)));
      case "upsert-sales-stage":
        return NextResponse.json({ stage: await upsertSalesStage({
          tenantSlug: context.tenantSlug, name: String(body.name),
          sequence: Number(body.sequence), probability: Number(body.probability ?? 0),
          isWon: body.isWon, isLost: body.isLost,
        }) });
      case "upsert-campaign":
        return NextResponse.json({ campaign: await upsertCampaign({
          tenantSlug: context.tenantSlug, name: String(body.name), description: body.description,
          triggerEvent: body.triggerEvent ?? null,
          emails: (body.emails ?? []).map((e: any) => ({
            delayDays: Number(e.delayDays ?? 0), subject: String(e.subject),
            bodyHtml: String(e.bodyHtml), bodyText: e.bodyText,
          })),
        }) });
      case "campaign-status":
        return NextResponse.json({ campaign: await setCampaignStatus(context.tenantSlug, String(body.campaignId), body.status) });
      case "enroll":
        return NextResponse.json(await enrollRecipient({
          tenantSlug: context.tenantSlug, campaignId: String(body.campaignId),
          recipientEmail: String(body.recipientEmail), recipientName: body.recipientName,
          recipientType: body.recipientType, recipientId: body.recipientId,
        }));
      case "process-sends":
        return NextResponse.json(await processCampaignSends(context.tenantSlug));
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const code = /not found|already|Invalid/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
