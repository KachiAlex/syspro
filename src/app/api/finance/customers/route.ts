export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listCustomers, upsertCustomer, customerOpenBalance } from "@/lib/finance/credit-control";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess, requireDocAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const code = url.searchParams.get("customerCode");
  try {
    if (code) {
      const open = await customerOpenBalance(context.tenantSlug, code);
      return NextResponse.json({ customerCode: code, openBalance: open });
    }
    const customers = await listCustomers(context.tenantSlug);
    return NextResponse.json({ customers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const schema = z.object({
  customerCode: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().nullish(),
  creditLimit: z.coerce.number().nonnegative().nullish(),
  creditHold: z.boolean().optional(),
  paymentTermId: z.string().uuid().nullish(),
  defaultCurrency: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireDocAccess(request, "customer", "edit", "finance", "write");
  if (!gate.ok) return gate.response;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    // Credit limit changes are risk decisions — for an existing customer the
    // new limit is staged in pending_credit_limit and routed through the
    // approval workflow; a brand-new customer's initial limit applies
    // directly. The credit_hold flag remains immediate (risk mitigation
    // must not wait on a chain).
    let creditLimitPending: { previousLimit: number | null; newLimit: number } | null = null;
    if (parsed.data.creditLimit != null) {
      const { sql } = await import("@/lib/sql-client");
      await sql`alter table finance_customers add column if not exists pending_credit_limit numeric`;
      const [existing] = await sql`
        select id, credit_limit, pending_credit_limit
        from finance_customers
        where tenant_slug = ${context.tenantSlug} and customer_code = ${parsed.data.customerCode}
        limit 1
      ` as any[];
      if (existing && Number(existing.credit_limit ?? 0) !== parsed.data.creditLimit) {
        if (existing.pending_credit_limit != null) {
          return NextResponse.json(
            { error: `A credit limit change to ${existing.pending_credit_limit} is already awaiting approval for this customer` },
            { status: 409 }
          );
        }
        await sql`
          update finance_customers set pending_credit_limit = ${parsed.data.creditLimit}
          where id = ${existing.id} and tenant_slug = ${context.tenantSlug}
        `;
        try {
          const { initiateApproval } = await import("@/lib/finance/approvals");
          await initiateApproval({
            tenantSlug: context.tenantSlug,
            entityType: "credit_limit_change",
            entityId: String(existing.id),
            requestedBy: context.userId,
            entityData: {
              amount: parsed.data.creditLimit,
              previousAmount: Number(existing.credit_limit ?? 0),
              reference: `Credit limit — ${parsed.data.customerCode}`,
              requestedByName: context.userId,
            },
          });
        } catch (approvalErr) {
          await sql`update finance_customers set pending_credit_limit = null where id = ${existing.id}`;
          throw approvalErr;
        }
        creditLimitPending = {
          previousLimit: Number(existing.credit_limit ?? 0),
          newLimit: parsed.data.creditLimit,
        };
        // Keep the effective limit untouched in the upsert below.
        delete parsed.data.creditLimit;
      }
    }
    await upsertCustomer({ tenantSlug: context.tenantSlug, ...parsed.data });
    return NextResponse.json({ ok: true, creditLimitPendingApproval: creditLimitPending }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
