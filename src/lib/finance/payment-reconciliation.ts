import { randomUUID } from "crypto";
import { db } from "../sql-client";
import { applyPaymentToBill } from "./vendor-payments";

export type PartyType = "customer" | "supplier";

export interface OpenDocument {
  id: string;
  number: string;
  date: string;
  partyId: string;
  party: string;
  total: number;
  balanceDue: number;
  currency?: string;
}

export interface UnallocatedPayment {
  id: string;
  reference: string;
  date: string;
  partyId: string | null;
  party: string | null;
  amount: number;
  unallocated: number;
  method?: string;
  currency?: string;
}

/**
 * Open customer invoices (balance due > 0) for the reconciliation workbench.
 */
export async function getOpenCustomerInvoices(
  tenantSlug: string,
  customerId?: string,
): Promise<OpenDocument[]> {
  const params: any[] = [tenantSlug];
  let where = `tenant_slug = $1 and status not in ('paid', 'void') and balance_due > 0`;
  if (customerId) {
    params.push(customerId);
    where += ` and (customer_id::text = $${params.length} or customer_code = $${params.length})`;
  }
  const { rows } = await db.query(
    `select id, invoice_number, issued_date, customer_id, customer_code, customer_name,
            amount, balance_due, currency
     from finance_invoices
     where ${where}
     order by issued_date, invoice_number`,
    params,
  );
  return (rows as any[]).map((r) => ({
    id: r.id,
    number: r.invoice_number,
    date: new Date(r.issued_date).toISOString().slice(0, 10),
    partyId: r.customer_id ?? r.customer_code ?? r.customer_name,
    party: r.customer_name ?? r.customer_code ?? "Unknown",
    total: Number(r.amount),
    balanceDue: Number(r.balance_due),
    currency: r.currency,
  }));
}

/**
 * Customer payments whose applied subledger allocations are less than the
 * payment amount (advances, overpayments, unmatched receipts).
 */
export async function getUnallocatedCustomerPayments(
  tenantSlug: string,
  customerId?: string,
): Promise<UnallocatedPayment[]> {
  const params: any[] = [tenantSlug];
  let where = `p.tenant_slug = $1 and p.status = 'successful'`;
  if (customerId) {
    params.push(customerId);
    where += ` and p.customer_id = $${params.length}`;
  }
  const { rows } = await db.query(
    `select p.id, p.reference, p.payment_date, p.customer_id, c.name party,
            p.net_amount, p.method,
            coalesce(a.applied, 0) applied
     from finance_payments p
     left join finance_customers c on c.id::text = p.customer_id
     left join (
       select payment_id, sum(amount) applied
       from payment_applications
       where tenant_slug = $1
       group by payment_id
     ) a on a.payment_id = p.id
     where ${where} and p.net_amount - coalesce(a.applied, 0) > 0.009
     order by p.payment_date`,
    params,
  );
  return (rows as any[]).map((r) => ({
    id: r.id,
    reference: r.reference,
    date: new Date(r.payment_date).toISOString().slice(0, 10),
    partyId: r.customer_id,
    party: r.party ?? r.customer_id,
    amount: Number(r.net_amount),
    unallocated: Number(r.net_amount) - Number(r.applied),
    method: r.method,
  }));
}

/**
 * Apply part of an existing customer payment to an open invoice.
 * Subledger allocation only — the receipt JE was posted when the payment
 * was recorded, so no new GL entry is created here.
 */
export async function applyCustomerPaymentToInvoice(input: {
  tenantSlug: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
}): Promise<{ invoiceId: string; balanceDue: number; status: string }> {
  const { tenantSlug, paymentId, invoiceId } = input;
  const amount = Number(input.amount);
  if (!(amount > 0)) throw new Error("Allocation amount must be positive");

  const { rows: payRows } = await db.query(
    `select p.net_amount, coalesce(a.applied,0) applied
     from finance_payments p
     left join (
       select payment_id, sum(amount) applied from payment_applications
       where tenant_slug = $1 group by payment_id
     ) a on a.payment_id = p.id
     where p.id = $2 and p.tenant_slug = $1 and p.status = 'successful'`,
    [tenantSlug, paymentId],
  );
  const pay = (payRows as any[])[0];
  if (!pay) throw new Error("Payment not found");
  const unallocated = Number(pay.net_amount) - Number(pay.applied);
  if (amount > unallocated + 0.009) {
    throw new Error(`Allocation exceeds unallocated payment amount (${unallocated.toFixed(2)})`);
  }

  const { rows: invRows } = await db.query(
    `select balance_due, status from finance_invoices
     where id = $1 and tenant_slug = $2`,
    [invoiceId, tenantSlug],
  );
  const inv = (invRows as any[])[0];
  if (!inv) throw new Error("Invoice not found");
  if (inv.status === "void" || inv.status === "paid") {
    throw new Error(`Cannot allocate to invoice with status: ${inv.status}`);
  }
  if (amount > Number(inv.balance_due) + 0.009) {
    throw new Error(`Allocation exceeds invoice balance due (${Number(inv.balance_due).toFixed(2)})`);
  }

  await db.query(
    `insert into payment_applications (id, tenant_slug, payment_id, invoice_id, amount, created_at)
     values ($1, $2, $3, $4, $5, now())`,
    [randomUUID(), tenantSlug, paymentId, invoiceId, amount],
  );

  const newBalance = Math.max(0, Number(inv.balance_due) - amount);
  const newStatus = newBalance <= 0.01 ? "paid" : "partially_paid";
  await db.query(
    `update finance_invoices
     set balance_due = $1, status = $2, updated_at = now()
     where id = $3 and tenant_slug = $4`,
    [newBalance, newStatus, invoiceId, tenantSlug],
  );

  try {
    const { markSchedulePaid } = await import("./credit-control");
    await markSchedulePaid(tenantSlug, invoiceId, amount);
  } catch (err) {
    console.error("Failed to update invoice payment schedule:", err);
  }

  // Keep linked_invoices in sync for downstream consumers
  await db.query(
    `update finance_payments
     set linked_invoices = array(
           select distinct unnest(coalesce(linked_invoices, '{}'::text[]) || $1::text)
         ),
         updated_at = now()
     where id = $2 and tenant_slug = $3`,
    [invoiceId, paymentId, tenantSlug],
  ).catch(() => undefined);

  return { invoiceId, balanceDue: newBalance, status: newStatus };
}

/**
 * Open supplier bills for the reconciliation workbench.
 */
export async function getOpenBills(
  tenantSlug: string,
  vendorId?: string,
): Promise<OpenDocument[]> {
  const params: any[] = [tenantSlug];
  let where = `b.tenant_slug = $1 and b.status not in ('paid', 'cancelled', 'void') and b.balance_due > 0`;
  if (vendorId) {
    params.push(vendorId);
    where += ` and b.vendor_id::text = $${params.length}`;
  }
  const { rows } = await db.query(
    `select b.id, b.bill_number, b.bill_date, b.vendor_id,
            coalesce(v.display_name, v.legal_name, b.vendor_id::text) party,
            b.total, b.balance_due, b.currency
     from bills b
     left join vendors v on v.id = b.vendor_id::text
     where ${where}
     order by b.bill_date, b.bill_number`,
    params,
  );
  return (rows as any[]).map((r) => ({
    id: r.id,
    number: r.bill_number,
    date: new Date(r.bill_date).toISOString().slice(0, 10),
    partyId: r.vendor_id,
    party: r.party,
    total: Number(r.total),
    balanceDue: Number(r.balance_due),
    currency: r.currency,
  }));
}

/**
 * Vendor payments with unapplied amounts remaining.
 */
export async function getUnappliedVendorPayments(
  tenantSlug: string,
  vendorId?: string,
): Promise<UnallocatedPayment[]> {
  const params: any[] = [tenantSlug];
  let where = `vp.tenant_slug = $1 and vp.unapplied_amount > 0.009`;
  if (vendorId) {
    params.push(vendorId);
    where += ` and vp.vendor_id::text = $${params.length}`;
  }
  const { rows } = await db.query(
    `select vp.id, vp.payment_number, vp.payment_date, vp.vendor_id,
            coalesce(v.display_name, v.legal_name, vp.vendor_id::text) party,
            vp.amount, vp.unapplied_amount, vp.method, vp.currency
     from vendor_payments vp
     left join vendors v on v.id = vp.vendor_id::text
     where ${where}
     order by vp.payment_date`,
    params,
  );
  return (rows as any[]).map((r) => ({
    id: r.id,
    reference: r.payment_number,
    date: new Date(r.payment_date).toISOString().slice(0, 10),
    partyId: r.vendor_id,
    party: r.party,
    amount: Number(r.amount),
    unallocated: Number(r.unapplied_amount),
    method: r.method,
    currency: r.currency,
  }));
}

/**
 * Apply part of an existing vendor payment to an open bill.
 */
export async function applyVendorPaymentToBill(input: {
  tenantSlug: string;
  paymentId: string;
  billId: string;
  amount: number;
}): Promise<void> {
  await applyPaymentToBill(input.paymentId, input.billId, Number(input.amount), input.tenantSlug);
}
