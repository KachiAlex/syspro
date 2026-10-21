import { createHmac, timingSafeEqual } from "crypto";

import { db } from "@/lib/sql-client";
import { handlePaymentCallback, createPaymentRequest } from "./gateway";

// Real Paystack + Flutterwave integration: gateway configs, transaction
// initialization producing live checkout URLs, and signed webhook handling
// that feeds the canonical AR receipt path (handlePaymentCallback).

export type GatewayProvider = "paystack" | "flutterwave";

export async function getGatewayConfig(tenantSlug: string, provider: GatewayProvider) {
  const row = (await db.query<any>(
    `select * from payment_gateway_configs
     where tenant_slug = $1 and provider = $2 and is_active`,
    [tenantSlug, provider]
  )).rows[0];
  return row ?? null;
}

export async function listGatewayConfigs(tenantSlug: string) {
  return (await db.query<any>(
    `select id, provider, public_key, mode, is_active, updated_at
     from payment_gateway_configs where tenant_slug = $1 order by provider`,
    [tenantSlug]
  )).rows;
}

export async function upsertGatewayConfig(input: {
  tenantSlug: string;
  provider: GatewayProvider;
  publicKey?: string;
  secretKey: string;
  webhookSecret?: string;
  mode?: "test" | "live";
  isActive?: boolean;
}) {
  return (await db.query<any>(
    `insert into payment_gateway_configs (tenant_slug, provider, public_key,
       secret_key, webhook_secret, mode, is_active)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (tenant_slug, provider) do update set
       public_key = excluded.public_key, secret_key = excluded.secret_key,
       webhook_secret = excluded.webhook_secret, mode = excluded.mode,
       is_active = excluded.is_active, updated_at = now()
     returning id, provider, mode, is_active`,
    [input.tenantSlug, input.provider, input.publicKey ?? null,
     input.secretKey, input.webhookSecret ?? null, input.mode ?? "test",
     input.isActive ?? true]
  )).rows[0];
}

async function paystackInitialize(cfg: any, args: {
  email: string; amount: number; currency: string; reference: string; callbackUrl?: string;
}) {
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.secret_key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: args.email,
      amount: Math.round(args.amount * 100), // kobo
      currency: args.currency,
      reference: args.reference,
      callback_url: args.callbackUrl,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json();
  if (!json.status) throw new Error(`Paystack init failed: ${json.message ?? res.status}`);
  return { checkoutUrl: json.data.authorization_url as string, accessCode: json.data.access_code as string };
}

async function flutterwaveInitialize(cfg: any, args: {
  email: string; amount: number; currency: string; reference: string; callbackUrl?: string;
}) {
  const res = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.secret_key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      tx_ref: args.reference,
      amount: args.amount,
      currency: args.currency,
      redirect_url: args.callbackUrl,
      customer: { email: args.email },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json();
  if (json.status !== "success") throw new Error(`Flutterwave init failed: ${json.message ?? res.status}`);
  return { checkoutUrl: json.data.link as string, accessCode: null };
}

/**
 * Create a payment request on the invoice + initialize a real provider
 * transaction, replacing the placeholder link with the live checkout URL.
 */
export async function initializeGatewayPayment(input: {
  tenantSlug: string;
  invoiceId: string;
  provider: GatewayProvider;
  customerEmail: string;
  callbackUrl?: string;
}) {
  const cfg = await getGatewayConfig(input.tenantSlug, input.provider);
  if (!cfg) throw new Error(`${input.provider} gateway is not configured`);

  const req = await createPaymentRequest({
    tenantSlug: input.tenantSlug,
    invoiceId: input.invoiceId,
    provider: input.provider,
    customerEmail: input.customerEmail,
  });

  const init = input.provider === "paystack"
    ? await paystackInitialize(cfg, {
        email: input.customerEmail, amount: req.amount,
        currency: req.currency, reference: req.reference,
        callbackUrl: input.callbackUrl,
      })
    : await flutterwaveInitialize(cfg, {
        email: input.customerEmail, amount: req.amount,
        currency: req.currency, reference: req.reference,
        callbackUrl: input.callbackUrl,
      });

  await db.query(
    `update payment_requests set link_url = $1, updated_at = now() where id = $2`,
    [init.checkoutUrl, req.id]
  );
  await db.query(
    `insert into payment_links (tenant_slug, provider, reference, amount,
       currency, invoice_id, payment_request_id, customer_email, checkout_url)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (tenant_slug, provider, reference) do update set
       checkout_url = excluded.checkout_url`,
    [input.tenantSlug, input.provider, req.reference, req.amount, req.currency,
     input.invoiceId, req.id, input.customerEmail, init.checkoutUrl]
  );
  return { reference: req.reference, checkoutUrl: init.checkoutUrl, amount: req.amount, currency: req.currency };
}

export function verifyPaystackSignature(secret: string, rawBody: string, signature: string | null) {
  if (!signature) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  try { return timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); }
  catch { return false; }
}

export function verifyFlutterwaveSignature(webhookSecret: string, verifHash: string | null) {
  if (!verifHash || !webhookSecret) return false;
  try { return timingSafeEqual(Buffer.from(webhookSecret), Buffer.from(verifHash)); }
  catch { return false; }
}

async function paystackVerify(cfg: any, reference: string) {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${cfg.secret_key}` },
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json();
  if (!json.status) throw new Error(`Paystack verify failed: ${json.message ?? res.status}`);
  const d = json.data;
  return { status: d.status === "success" ? "paid" : "failed", amount: Number(d.amount) / 100, providerRef: String(d.id) };
}

async function flutterwaveVerify(cfg: any, txId: string) {
  const res = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(txId)}/verify`, {
    headers: { Authorization: `Bearer ${cfg.secret_key}` },
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json();
  if (json.status !== "success") throw new Error(`Flutterwave verify failed: ${json.message ?? res.status}`);
  const d = json.data;
  return {
    status: d.status === "successful" ? "paid" : "failed",
    amount: Number(d.amount),
    providerRef: String(d.id),
    reference: String(d.tx_ref),
  };
}

/**
 * Provider webhook entry point — verifies the signature, optionally
 * re-verifies with the provider API, then posts the AR receipt.
 */
export async function handleGatewayWebhook(input: {
  tenantSlug: string;
  provider: GatewayProvider;
  rawBody: string;
  signature: string | null;
}) {
  const cfg = await getGatewayConfig(input.tenantSlug, input.provider);
  if (!cfg) throw new Error(`${input.provider} gateway is not configured`);

  let reference: string;
  let providerRef: string | undefined;
  let eventStatus: "paid" | "failed";

  if (input.provider === "paystack") {
    if (!verifyPaystackSignature(cfg.secret_key, input.rawBody, input.signature))
      throw new Error("Invalid Paystack signature");
    const evt = JSON.parse(input.rawBody);
    if (evt.event !== "charge.success") {
      if (evt.event === "charge.failed") eventStatus = "failed";
      else return { ignored: true, event: evt.event };
    } else eventStatus = "paid";
    reference = evt.data?.reference;
    providerRef = evt.data?.id ? String(evt.data.id) : undefined;
    // Re-verify server-side per Paystack docs.
    if (eventStatus === "paid" && reference) {
      const v = await paystackVerify(cfg, reference);
      eventStatus = v.status === "paid" ? "paid" : "failed";
    }
  } else {
    if (!verifyFlutterwaveSignature(cfg.webhook_secret ?? cfg.secret_key, input.signature))
      throw new Error("Invalid Flutterwave signature");
    const evt = JSON.parse(input.rawBody);
    if (evt.event !== "charge.completed") return { ignored: true, event: evt.event };
    const v = await flutterwaveVerify(cfg, String(evt.data?.id));
    reference = v.reference;
    providerRef = v.providerRef;
    eventStatus = v.status === "paid" ? "paid" : "failed";
  }

  if (!reference) throw new Error("Webhook missing transaction reference");

  const result = await handlePaymentCallback({
    tenantSlug: input.tenantSlug,
    provider: input.provider,
    reference,
    providerReference: providerRef,
    status: eventStatus,
    paymentDate: new Date().toISOString().slice(0, 10),
  });

  await db.query(
    `update payment_links set status=$1, paid_at = case when $1='paid' then now() else paid_at end,
       payment_entry_id = $2, gateway_response = $3
     where tenant_slug=$4 and provider=$5 and reference=$6`,
    [eventStatus === "paid" ? "paid" : "failed",
     (result as any).paymentId ?? null, input.rawBody.slice(0, 8000),
     input.tenantSlug, input.provider, reference]
  );
  return result;
}

export async function listPaymentLinks(tenantSlug: string, invoiceId?: string) {
  return (await db.query<any>(
    `select * from payment_links where tenant_slug = $1
     ${invoiceId ? "and invoice_id = $2" : ""} order by created_at desc`,
    invoiceId ? [tenantSlug, invoiceId] : [tenantSlug]
  )).rows;
}
