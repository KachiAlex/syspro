import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CRM_PIPELINE_STAGES } from "@/lib/crm/types";
import { updateDeal, deleteDeal, updateLead, logActivity } from "@/lib/crm/db";
import { insertFinanceInvoice } from "@/lib/finance/db";
import { writeFinanceEvent } from "@/lib/finance/events";
import { getCurrentUser } from "@/lib/auth-helpers";
import { handleDatabaseError } from "@/lib/api-errors";

const patchSchema = z.object({
  stage: z.enum(CRM_PIPELINE_STAGES).optional(),
  probability: z.number().min(0).max(100).optional(),
  assignedOfficerId: z.string().optional(),
  status: z.string().optional(),
  value: z.number().min(0).optional(),
  currency: z.string().min(1).max(8).optional(),
  expectedClose: z.string().optional().or(z.literal("")),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const deal = await updateDeal(params.id, {
      stage: parsed.data.stage,
      probability: parsed.data.probability,
      assignedOfficerId: parsed.data.assignedOfficerId,
      status: parsed.data.status,
      value: parsed.data.value,
      currency: parsed.data.currency,
      expectedClose: parsed.data.expectedClose === "" ? null : parsed.data.expectedClose,
    });
    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // Chain 1: CRM → Finance auto-invoice on deal won
    if (parsed.data.stage === "closed_won") {
      // Publish finance event
      writeFinanceEvent({
        tenantSlug: deal.tenantSlug,
        eventType: "deal_won",
        sourceModule: "crm",
        sourceRecordId: deal.id,
        userId: getCurrentUser(request)?.id,
        amount: deal.value,
        currency: deal.currency || "NGN",
        metadata: { dealName: deal.name, customerId: deal.customerId, leadId: deal.leadId },
      });

      // Auto-draft invoice
      try {
        const invoice = await insertFinanceInvoice({
          tenantSlug: deal.tenantSlug,
          customerName: deal.customerId || "Customer",
          invoiceNumber: `INV-DEAL-${Date.now()}`,
          issuedDate: new Date().toISOString().split("T")[0],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          currency: deal.currency || "NGN",
          amount: deal.value || 0,
          status: "draft",
          lineItems: [
            {
              description: deal.name || "Deal services",
              quantity: 1,
              unitPrice: deal.value || 0,
              amount: deal.value || 0,
            },
          ],
        });

        // Log the auto-invoice creation
        logActivity({
          tenantSlug: deal.tenantSlug,
          entityType: "deal",
          entityId: params.id,
          action: "deal_won_invoice_drafted",
          description: `Auto-drafted invoice ${invoice.invoiceNumber} for won deal`,
          metadata: { invoiceId: invoice.id, amount: deal.value },
        }).catch(() => {});
      } catch (invoiceErr) {
        console.error("[DealWon] Auto-invoice draft failed:", invoiceErr);
        // Don't fail the deal update if invoice drafting fails
      }
    }

    // Status cascading: sync linked lead stage when deal closes
    if (parsed.data.stage && deal.leadId) {
      if (parsed.data.stage === "closed_won") {
        await updateLead(deal.leadId, { stage: "converted" }).catch(() => {});
      } else if (parsed.data.stage === "closed_lost") {
        await updateLead(deal.leadId, { stage: "lost" }).catch(() => {});
      }
    }

    // Log activity
    if (parsed.data.stage) {
      await logActivity({
        tenantSlug: deal.tenantSlug,
        entityType: "deal",
        entityId: params.id,
        action: "deal_stage_changed",
        description: `Deal moved to ${parsed.data.stage}`,
        metadata: { stage: parsed.data.stage, leadId: deal.leadId, customerId: deal.customerId },
      }).catch(() => {});
    }

    return NextResponse.json({ deal });
  } catch (error) {
    return handleDatabaseError(error, "Deal update");
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;

  try {
    const deleted = await deleteDeal(params.id);
    if (!deleted) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleDatabaseError(error, "Deal deletion");
  }
}
