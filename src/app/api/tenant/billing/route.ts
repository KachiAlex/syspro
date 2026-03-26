import { NextRequest, NextResponse } from "next/server";
import {
  validateTenantContext,
  parseJsonRequest,
  getPaginationParams,
  getSortParams,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
} from "@/lib/tenant-admin/utils";
import { AuditService } from "@/lib/tenant-admin/service";
import { z } from "zod";

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

    if (!checkRateLimit(`bill-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const type = new URL(request.url).searchParams.get("type") || "overview";
    const pagination = getPaginationParams(request);
    const sort = getSortParams(request);

    if (type === "invoices") {
      return NextResponse.json({
        success: true,
        data: {
          invoices: [],
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: 0,
          },
        },
      });
    } else if (type === "subscriptions") {
      return NextResponse.json({
        success: true,
        data: {
          subscriptions: [],
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: 0,
          },
        },
      });
    } else if (type === "usage") {
      return NextResponse.json({
        success: true,
        data: {
          monthlyUsage: [],
          currentUsage: {},
          limits: {},
        },
      });
    } else if (type === "overview") {
      return NextResponse.json({
        success: true,
        data: {
          currentPlan: null,
          nextBillingDate: null,
          totalDue: 0,
          invoiceCount: 0,
          subscriptionStatus: "inactive",
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
    const action = new URL(request.url).searchParams.get("action") || "subscribe";

    if (action === "subscribe") {
      const parsed = await parseJsonRequest(
        request,
        z.object({
          planId: z.string(),
          seats: z.number().optional(),
        })
      );
      if (!parsed.success) {
        return errorResponse(parsed.error, 400, parsed.details);
      }

      const subscription = {
        id: `sub-${Date.now()}`,
        ...parsed.data,
        tenantSlug: context.tenantSlug,
        status: "active",
        createdAt: new Date().toISOString(),
        createdBy: context.userId,
      };

      const auditService = new AuditService(context.tenantSlug);
      await auditService.log({
        userId: context.userId,
        action: "create",
        resource: "subscription",
        resourceId: subscription.id,
        changes: { after: subscription },
      });

      return NextResponse.json(
        {
          success: true,
          data: subscription,
          message: "Subscription created successfully",
        },
        { status: 201 }
      );
    } else if (action === "create_invoice") {
      return await POST_createInvoice(request);
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

export async function POST_createInvoice(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const parsed = await parseJsonRequest(request, CreateInvoiceSchema);
    if (!parsed.success) return errorResponse(parsed.error, 400, parsed.details);

    const inv = {
      id: `inv-${Date.now()}`,
      ...parsed.data.invoice,
      tenantSlug: context.tenantSlug,
      createdAt: new Date().toISOString(),
      createdBy: context.userId,
    } as any;

    const auditService = new AuditService(context.tenantSlug);
    await auditService.log({ userId: context.userId, action: "create", resource: "invoice", resourceId: inv.id, changes: { after: inv } });

    return NextResponse.json({ success: true, data: inv, message: "Invoice created successfully" }, { status: 201 });
  } catch (error) {
    console.error("Billing create invoice error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * PATCH /api/tenant/billing?id=<id>
 * Update subscription
 */
export async function PATCH(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return errorResponse("Subscription ID is required", 400);
    }

    const parsed = await parseJsonRequest(request, UpdateSubscriptionSchema);
    if (!parsed.success) {
      return errorResponse(parsed.error, 400, parsed.details);
    }

    const updated = {
      id,
      ...parsed.data,
      tenantSlug: context.tenantSlug,
      updatedAt: new Date().toISOString(),
      updatedBy: context.userId,
    };

    const auditService = new AuditService(context.tenantSlug);
    await auditService.log({
      userId: context.userId,
      action: "update",
      resource: "subscription",
      resourceId: id,
      changes: { after: updated },
    });

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
 * DELETE /api/tenant/billing?id=<id>
 * Cancel subscription
 */
export async function DELETE(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "delete");
    const id = new URL(request.url).searchParams.get("id");

    if (!id) {
      return errorResponse("Subscription ID is required", 400);
    }

    const auditService = new AuditService(context.tenantSlug);
    await auditService.log({
      userId: context.userId,
      action: "cancel",
      resource: "subscription",
      resourceId: id,
    });

    return NextResponse.json({
      success: true,
      message: "Subscription cancelled successfully",
    });
  } catch (error) {
    console.error("Billing DELETE error:", error);
    return handleTenantAdminError(error);
  }
}
