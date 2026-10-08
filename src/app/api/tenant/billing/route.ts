export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  validateTenantContext,
  parseJsonRequest,
  getPaginationParams,
  getSortParams,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
  asTenantSlug,
} from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";
import { AuditService } from "@/lib/tenant-admin/service";
import { TenantSlug, UserId, ResourceId, AuditAction } from "@/lib/tenant-admin/types";
import { z } from "zod";
import {
  listFinanceInvoices,
  insertFinanceInvoice,
  updateFinanceInvoice,
  listSubscriptions,
  insertSubscription,
  updateSubscription,
  deleteSubscription,
} from "@/lib/finance/db";

const BillingPlanSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().positive(),
  interval: z.enum(["monthly", "yearly"]),
  features: z.array(z.string()).optional(),
  trialDays: z.number().optional(),
});

const UpdateSubscriptionSchema = z.object({
  planId: z.string().optional(),
  seats: z.number().positive().optional(),
  status: z.enum(["active", "paused", "cancelled"]).optional(),
});

/**
 * GET /api/tenant/billing
 * Retrieve billing info: invoices, subscriptions, usage
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    const _gate1 = await requireModuleGate(request, "billing", "read");
    if (_gate1) return _gate1;

    if (!checkRateLimit(`bill-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "overview";
    const action = url.searchParams.get("action");
    const pagination = getPaginationParams(request);
    const sort = getSortParams(request);

    if (action === "download") {
      const invoiceId = url.searchParams.get("invoiceId");
      if (!invoiceId) {
        return errorResponse("invoiceId is required", 400);
      }
      // Return invoice data as JSON for frontend PDF generation
      const invoices = await listFinanceInvoices({ tenantSlug: context.tenantSlug });
      const invoice = invoices.find((i) => i.id === invoiceId);
      if (!invoice) {
        return errorResponse("Invoice not found", 404);
      }
      return NextResponse.json({
        success: true,
        data: invoice,
      });
    }

    if (type === "invoices") {
      const invoices = await listFinanceInvoices({
        tenantSlug: context.tenantSlug,
        limit: pagination.limit,
        offset: pagination.offset,
      });

      return NextResponse.json({
        success: true,
        data: {
          invoices,
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: invoices.length,
          },
        },
      });
    } else if (type === "subscriptions") {
      const subscriptions = await listSubscriptions(context.tenantSlug);

      return NextResponse.json({
        success: true,
        data: {
          subscriptions,
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: subscriptions.length,
          },
        },
      });
    } else if (type === "usage") {
      const { getTenantUsageSummary } = await import("@/lib/tenant-usage");
      const usage = await getTenantUsageSummary(context.tenantSlug);
      return NextResponse.json({
        success: true,
        data: usage,
      });
    } else if (type === "overview") {
      const invoices = await listFinanceInvoices({ tenantSlug: context.tenantSlug });
      const subscriptions = await listSubscriptions(context.tenantSlug);
      const activeSubscription = subscriptions.find((s) => s.status === "active" || s.status === "trial");
      const totalDue = invoices
        .filter((i) => i.status !== "paid" && i.status !== "void")
        .reduce((sum, i) => sum + (i.balanceDue || 0), 0);

      return NextResponse.json({
        success: true,
        data: {
          currentPlan: activeSubscription?.plan || null,
          nextBillingDate: activeSubscription?.nextBillingDate || null,
          totalDue,
          invoiceCount: invoices.length,
          subscriptionStatus: activeSubscription?.status || "inactive",
        },
      });
    } else {
      return errorResponse("Invalid type parameter", 400);
    }
  } catch (error) {
    console.error("Billing GET error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * POST /api/tenant/billing
 * Create invoice, start subscription, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const _gate2 = await requireModuleGate(request, "billing", "write");
    if (_gate2) return _gate2;
    const action = new URL(request.url).searchParams.get("action") || "subscribe";

    if (action === "subscribe") {
      const parsed = await parseJsonRequest(
        request,
        z.object({
          planId: z.string(),
          seats: z.number().optional(),
          price: z.number().optional(),
          features: z.array(z.string()).optional(),
        })
      );
      if (!parsed.success) {
        return errorResponse(parsed.error, 400, parsed.details);
      }

      const subscription = await insertSubscription({
        tenantSlug: context.tenantSlug,
        plan: parsed.data.planId,
        seats: parsed.data.seats,
        price: parsed.data.price,
        features: parsed.data.features,
      });

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId as UserId,
        "create" as AuditAction,
        "subscription",
        subscription.id as ResourceId,
        { after: subscription }
      );

      return NextResponse.json(
        {
          success: true,
          data: subscription,
          message: "Subscription created successfully",
        },
        { status: 201 }
      );
    } else if (action === "create_invoice") {
      return await createInvoiceHandler(request);
    } else {
      return errorResponse("Invalid action", 400);
    }
  } catch (error) {
    console.error("Billing POST error:", error);
    return handleTenantAdminError(error);
  }
}

// Support creating invoices from tenant-admin UI: POST /api/tenant/billing?action=create_invoice
const CreateInvoiceSchema = z.object({
  invoice: z.object({
    customerName: z.string().min(1),
    invoiceNumber: z.string().min(1),
    issuedDate: z.string().optional(),
    dueDate: z.string().optional(),
    currency: z.string().optional(),
    amount: z.number().positive(),
    balanceDue: z.number().optional(),
    status: z.string().optional(),
    lineItems: z.array(z.object({ description: z.string(), quantity: z.number(), unitPrice: z.number(), taxRate: z.number().optional(), amount: z.number() })).optional(),
  }),
});

// Helper function to create invoice
async function createInvoiceHandler(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const _gate3 = await requireModuleGate(request, "billing", "write");
    if (_gate3) return _gate3;
    const parsed = await parseJsonRequest(request, CreateInvoiceSchema);
    if (!parsed.success) return errorResponse(parsed.error, 400, parsed.details);

    const invData = parsed.data.invoice;
    const inv = await insertFinanceInvoice({
      tenantSlug: context.tenantSlug,
      customerName: invData.customerName,
      invoiceNumber: invData.invoiceNumber,
      issuedDate: invData.issuedDate || new Date().toISOString().split("T")[0],
      dueDate: invData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      currency: invData.currency || "₦",
      amount: invData.amount,
      balanceDue: invData.balanceDue ?? invData.amount,
      status: (invData.status as any) || "draft",
      lineItems: (invData.lineItems || []).map((line: any) => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        amount: line.amount ?? line.quantity * line.unitPrice,
        taxRate: line.taxRate,
      })),
    });

    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(context.tenantSlug),
      context.userId as UserId,
      "create" as AuditAction,
      "invoice",
      inv.id as ResourceId,
      { after: inv }
    );

    return NextResponse.json({ success: true, data: inv, message: "Invoice created successfully" }, { status: 201 });
  } catch (error) {
    console.error("Billing create invoice error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * PATCH /api/tenant/billing?id=<id>&action=upgrade
 * Update subscription or invoice
 */
export async function PATCH(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const _gate4 = await requireModuleGate(request, "billing", "write");
    if (_gate4) return _gate4;
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const action = url.searchParams.get("action");
    // Read the body once — request.json() can only be consumed once.
    const body = await request.json().catch(() => ({}));
    const subscriptionParsed = UpdateSubscriptionSchema.safeParse(body);

    if (action === "upgrade") {
      const subscriptionId = body.subscriptionId || id;
      const newPlan = body.newPlan;

      if (!subscriptionId || !newPlan) {
        return errorResponse("subscriptionId and newPlan are required", 400);
      }

      const updated = await updateSubscription(subscriptionId, { plan: newPlan }, context.tenantSlug);
      if (!updated) {
        return errorResponse("Subscription not found", 404);
      }

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId as UserId,
        "update" as AuditAction,
        "subscription",
        subscriptionId as ResourceId,
        { after: updated }
      );

      return NextResponse.json({
        success: true,
        data: updated,
        message: `Successfully upgraded to ${newPlan} plan`,
      });
    }

    // Handle invoice status update (mark paid)
    if (body.invoiceId) {
      const updates = body.updates || {};
      const updated = await updateFinanceInvoice(body.invoiceId, {
        status: updates.status as any,
        balanceDue: updates.status === "paid" ? 0 : undefined,
      }, context.tenantSlug);
      if (!updated) {
        return errorResponse("Invoice not found", 404);
      }

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId as UserId,
        "update" as AuditAction,
        "invoice",
        body.invoiceId as ResourceId,
        { after: updated }
      );

      return NextResponse.json({
        success: true,
        data: updated,
        message: "Invoice updated successfully",
      });
    }

    // Fallback: subscription update by ID
    if (!id) {
      return errorResponse("ID is required", 400);
    }

    if (!subscriptionParsed.success) {
      return errorResponse("Validation failed", 400, subscriptionParsed.error.flatten());
    }

    const updated = await updateSubscription(id, {
      status: subscriptionParsed.data.status as any,
      seats: subscriptionParsed.data.seats,
    }, context.tenantSlug);
    if (!updated) {
      return errorResponse("Subscription not found", 404);
    }

    const auditService = new AuditService();
    await auditService.log(
      asTenantSlug(context.tenantSlug),
      context.userId as UserId,
      "update" as AuditAction,
      "subscription",
      id as ResourceId,
      { after: updated }
    );

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Subscription updated successfully",
    });
  } catch (error) {
    console.error("Billing PATCH error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * DELETE /api/tenant/billing?id=<id>&type=subscription
 * Cancel subscription
 */
export async function DELETE(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "delete");
    const _gate5 = await requireModuleGate(request, "billing", "write");
    if (_gate5) return _gate5;
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const type = url.searchParams.get("type") || "subscription";

    if (!id) {
      return errorResponse("ID is required", 400);
    }

    if (type === "subscription") {
      const deleted = await deleteSubscription(id, context.tenantSlug);
      if (!deleted) {
        return errorResponse("Subscription not found", 404);
      }

      const auditService = new AuditService();
      await auditService.log(
        asTenantSlug(context.tenantSlug),
        context.userId as UserId,
        "delete" as AuditAction,
        "subscription",
        id as ResourceId,
        {}
      );
    }

    return NextResponse.json({ success: true, message: "Subscription cancelled" });
  } catch (error) {
    console.error("Billing DELETE error:", error);
    return handleTenantAdminError(error);
  }
}
