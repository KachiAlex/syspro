import { randomUUID } from "crypto";

import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { receiveInvoicePayment } from "./db";

// ---------------------------------------------------------------------------
// Payment-request framework: generates a provider payment link/reference for
// an invoice and turns provider callbacks into GL-posted receipts. Provider
// network calls are intentionally stubbed — credentials/webhooks are wired
// per deployment; the bookkeeping and GL integration are real.
// ---------------------------------------------------------------------------

export function ensureGatewayTables() {
  return ensureOnce("finance/gateway:ensureTables", ensureGatewayTablesRun);
}

async function ensureGatewayTablesRun() {
  const sql = SQL;
  await sql`create table if not exists payment_requests (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    invoice_id text not null,
    provider text not null,
    reference text not null,
    amount numeric not null,
    currency text,
    status text not null default 'pending',
    link_url text,
    provider_reference text,
    paid_payment_id text,
    metadata jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;
}

type Provider = "paystack" | "flutterwave" | "stripe" | "manual";

async function nextRequestRef(tenantSlug: string): Promise<string> {
  const rows = (await db.query<{ n: number }>(
    `select count(*) + 1 as n from payment_requests where tenant_slug = $1`,
    [tenantSlug]
  )).rows;
  return `PR-${String(rows[0]?.n ?? 1).padStart(6, "0")}`;
}

// Generates a provider checkout link. Without provider credentials the link
// is a documented placeholder carrying the reference — swap in the real API
// call per deployment.
function providerLink(provider: Provider, reference: string, amount: number, currency?: string) {
  switch (provider) {
    case "paystack":
      return `https://paystack.com/pay/${reference}?amount=${amount}`;
    case "flutterwave":
      return `https://checkout.flutterwave.com/pay/${reference}`;
    case "stripe":
      return `https://checkout.stripe.com/c/pay/${reference}`;
    default:
      return null;
  }
}

export async function createPaymentRequest(input: {
  tenantSlug: string;
  invoiceId: string;
  provider: Provider;
  customerEmail?: string;
}) {
  await ensureGatewayTables();
  const inv = (await db.query<any>(
    `select * from finance_invoices where id = $1 and tenant_slug = $2`,
    [input.invoiceId, input.tenantSlug]
  )).rows[0];
  if (!inv) throw new Error(`Invoice ${input.invoiceId} not found`);
  if (!["sent", "partially_paid", "overdue"].includes(inv.status))
    throw new Error(`Cannot request payment for invoice with status '${inv.status}'`);
  const amount = Number(inv.balance_due);
  if (amount <= 0) throw new Error("Invoice has no balance due");

  const id = randomUUID();
  const reference = await nextRequestRef(input.tenantSlug);
  const currency = inv.transaction_currency ?? inv.currency ?? "NGN";
  const link = providerLink(input.provider, reference, amount, currency);

  await db.query(
    `insert into payment_requests (id, tenant_slug, invoice_id, provider, reference,
       amount, currency, link_url, metadata)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, input.tenantSlug, input.invoiceId, input.provider, reference,
     amount, currency, link,
     JSON.stringify({ customerEmail: input.customerEmail ?? null })]
  );

  // The payment link itself is the customer-facing notification — sent to the
  // explicit customer email or the one stored on the invoice/customer record.
  const partyEmail = input.customerEmail ?? inv.customer_email ?? null;
  if (partyEmail) {
    try {
      const { emitEvent } = await import("@/lib/notify");
      void emitEvent({
        tenantSlug: input.tenantSlug,
        eventType: "payment_request.created",
        sourceModule: "finance",
        sourceRecordId: id,
        dedupeKey: `payreq:${id}`,
        payload: {
          invoiceNumber: inv.invoice_number,
          invoiceId: input.invoiceId,
          customerName: inv.customer_name,
          customerId: inv.customer_id,
          customerCode: inv.customer_code,
          amount,
          currency,
          linkUrl: link,
          partyEmail,
        },
      });
    } catch (err) {
      console.error("Failed to emit payment_request.created:", err);
    }
  }

  return { id, reference, amount, currency, linkUrl: link, status: "pending" };
}

export async function listPaymentRequests(tenantSlug: string, invoiceId?: string) {
  await ensureGatewayTables();
  return (await db.query<any>(
    `select * from payment_requests where tenant_slug = $1
     ${invoiceId ? "and invoice_id = $2" : ""} order by created_at desc`,
    invoiceId ? [tenantSlug, invoiceId] : [tenantSlug]
  )).rows;
}

// Provider webhook/callback: verify reference, mark paid, receive the payment
// through the canonical AR path (posts Dr cash / Cr AR in the GL).
export async function handlePaymentCallback(input: {
  tenantSlug: string;
  provider: Provider;
  reference: string;
  providerReference?: string;
  status: "paid" | "failed";
  paidAmount?: number;
  paymentDate: string;
}) {
  await ensureGatewayTables();
  const req = (await db.query<any>(
    `select * from payment_requests where reference = $1 and tenant_slug = $2`,
    [input.reference, input.tenantSlug]
  )).rows[0];
  if (!req) throw new Error(`Payment request ${input.reference} not found`);
  if (req.provider !== input.provider)
    throw new Error("Provider mismatch on payment request");
  if (req.status !== "pending")
    return { status: req.status, alreadyProcessed: true };

  if (input.status === "failed") {
    await db.query(
      `update payment_requests set status='failed', provider_reference=$1,
         updated_at=now() where id=$2`,
      [input.providerReference ?? null, req.id]
    );
    return { status: "failed" };
  }

  const paidAmount = input.paidAmount ?? Number(req.amount);
  if (Math.abs(paidAmount - Number(req.amount)) > 0.02 * Number(req.amount))
    throw new Error(
      `Paid amount ${paidAmount} deviates >2% from request ${req.amount}`
    );

  const receipt = await receiveInvoicePayment({
    tenantSlug: input.tenantSlug,
    invoiceId: req.invoice_id,
    amount: paidAmount,
    method: req.provider === "manual" ? "bank_transfer" : req.provider,
    gateway: req.provider === "manual" ? "manual" : req.provider,
    gatewayReference: input.providerReference ?? input.reference,
    reference: `GW-${input.reference}`,
    paymentDate: input.paymentDate,
    metadata: { paymentRequestId: req.id, provider: req.provider },
  });

  await db.query(
    `update payment_requests set status='paid', provider_reference=$1,
       paid_payment_id=$2, updated_at=now() where id=$3`,
    [input.providerReference ?? null, receipt.payment.id, req.id]
  );
  return { status: "paid", paymentId: receipt.payment.id, invoice: receipt.invoice };
}

// ---------------------------------------------------------------------------
// E-invoice document: machine-readable invoice payload (UBL-flavoured JSON).
// ---------------------------------------------------------------------------
export async function generateEInvoice(tenantSlug: string, invoiceId: string) {
  const inv = (await db.query<any>(
    `select * from finance_invoices where id = $1 and tenant_slug = $2`,
    [invoiceId, tenantSlug]
  )).rows[0];
  if (!inv) throw new Error(`Invoice ${invoiceId} not found`);
  const lines = (await db.query<any>(
    `select * from finance_invoice_lines where invoice_id = $1`, [invoiceId]
  )).rows;

  const subtotal = lines.reduce((s: number, l: any) => s + Number(l.amount), 0);
  const taxTotal = Number(inv.amount) - subtotal;
  return {
    documentType: "invoice",
    specification: "urn:cen.eu:en16931:2017",
    issueDate: String(inv.issued_date).slice(0, 10),
    dueDate: String(inv.due_date).slice(0, 10),
    invoiceNumber: inv.invoice_number,
    currency: inv.transaction_currency ?? inv.currency ?? "NGN",
    supplier: { name: inv.tenant_slug, id: inv.tenant_slug },
    customer: {
      name: inv.customer_name,
      code: inv.customer_code ?? null,
      purchaseOrderReference: inv.purchase_order ?? null,
    },
    totals: {
      taxExclusiveAmount: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxTotal * 100) / 100,
      taxInclusiveAmount: Number(inv.amount),
      payableAmount: Number(inv.balance_due),
    },
    lines: lines.map((l: any, i: number) => ({
      lineId: i + 1,
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unit_price),
      amount: Number(l.amount),
      accountCode: l.account_code ?? null,
      taxRate: l.tax_rate == null ? null : Number(l.tax_rate),
    })),
    status: inv.status,
    generatedAt: new Date().toISOString(),
  };
}
