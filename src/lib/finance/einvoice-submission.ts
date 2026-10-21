import { randomUUID } from "node:crypto";
import { sql as SQL } from "../sql-client";
import { generateEInvoice } from "./gateway";
import { ensureOnce } from "@/lib/ensure-once";

export interface EInvoiceSubmission {
  id: string;
  invoiceId: string;
  provider: string;
  irn: string;
  status: "submitted" | "accepted" | "rejected";
  submittedBy: string | null;
  submittedAt: string;
  response: any;
}

interface ProviderResult {
  status: "accepted" | "rejected";
  reference: string;
  message?: string;
  raw?: any;
}

// Provider adapters. The sandbox adapter validates the document structure and
// returns a deterministic acceptance so the full submission lifecycle can be
// exercised end-to-end. The "app" provider is a generic Access Point Provider
// adapter — NRS/FIRS e-invoicing is reached through an accredited APP
// (DigiTax, Elyonar/Yona, etc.), never directly. Configure it per tenant via
// settings.einvoiceApp = { baseUrl, apiKey, submitPath } or globally via the
// EINVOICE_APP_BASE_URL / EINVOICE_APP_API_KEY / EINVOICE_APP_SUBMIT_PATH env
// vars. The request body is { irn, invoice: <UBL doc> }; any JSON response
// containing a recognizable status/reference field is mapped onto the
// ProviderResult shape.
async function loadAppConfig(tenantSlug: string): Promise<{
  baseUrl: string; apiKey: string; submitPath: string;
}> {
  const sql = SQL;
  const rows = (await sql`
    select settings->'einvoiceApp' as cfg from tenants where slug = ${tenantSlug}
  `) as any[];
  const cfg = rows[0]?.cfg;
  const parsed = typeof cfg === "string" ? JSON.parse(cfg) : cfg;
  const baseUrl = parsed?.baseUrl ?? process.env.EINVOICE_APP_BASE_URL;
  const apiKey = parsed?.apiKey ?? process.env.EINVOICE_APP_API_KEY;
  const submitPath =
    parsed?.submitPath ?? process.env.EINVOICE_APP_SUBMIT_PATH ?? "/i/v1/invoices";
  if (!baseUrl || !apiKey) {
    throw new Error(
      "No e-invoice APP configured — set tenant settings.einvoiceApp or EINVOICE_APP_BASE_URL/EINVOICE_APP_API_KEY"
    );
  }
  return { baseUrl: String(baseUrl).replace(/\/$/, ""), apiKey, submitPath };
}

const PROVIDERS: Record<
  string,
  (doc: any, irn: string, tenantSlug: string) => Promise<ProviderResult>
> = {
  "firs-sandbox": async (doc, irn) => {
    const errors: string[] = [];
    if (!doc.invoiceNumber) errors.push("invoiceNumber missing");
    if (!doc.customer?.name) errors.push("customer name missing");
    if (!doc.totals || doc.totals.payableAmount == null) errors.push("totals missing");
    if (!Array.isArray(doc.lines) || doc.lines.length === 0) errors.push("no lines");
    if (errors.length > 0) {
      return { status: "rejected", reference: irn, message: errors.join("; ") };
    }
    return {
      status: "accepted",
      reference: irn,
      message: "Accepted by sandbox clearance service",
      raw: { csid: `CSID-${irn.slice(-14)}` },
    };
  },

  // Generic APP submission — works with DigiTax/Yona-style JSON APIs.
  app: async (doc, irn, tenantSlug) => {
    const { baseUrl, apiKey, submitPath } = await loadAppConfig(tenantSlug);
    const res = await fetch(`${baseUrl}${submitPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ irn, invoice: doc }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        status: "rejected",
        reference: irn,
        message: body?.message ?? body?.error ?? `APP responded ${res.status}`,
        raw: body,
      };
    }
    const ref = body?.reference ?? body?.irn ?? body?.id ?? irn;
    const accepted =
      body?.status == null ||
      /accept|success|signed|cleared|transmit/i.test(String(body.status)) ||
      res.status === 200 || res.status === 201;
    return {
      status: accepted ? "accepted" : "rejected",
      reference: String(ref),
      message: body?.message ?? (accepted ? "Accepted by access point" : "Rejected by access point"),
      raw: body,
    };
  },
};

export function ensureEInvoiceTables(...args: Parameters<typeof ensureEInvoiceTablesRun>) {
  return ensureOnce("finance/einvoice-submission:ensureEInvoiceTables", () => ensureEInvoiceTablesRun(...args));
}

async function ensureEInvoiceTablesRun(sql = SQL) {
  await sql`
    create table if not exists einvoice_submissions (
      id text primary key,
      tenant_slug text not null,
      invoice_id text not null,
      provider text not null default 'firs-sandbox',
      irn text not null,
      status text not null,
      payload jsonb,
      response jsonb,
      submitted_by text,
      submitted_at timestamptz not null default now(),
      created_at timestamptz not null default now()
    )
  `;
  await sql`alter table if exists finance_invoices add column if not exists einvoice_status text`;
  await sql`alter table if exists finance_invoices add column if not exists einvoice_irn text`;
}

export async function submitEInvoice(
  tenantSlug: string,
  invoiceId: string,
  opts: { provider?: string; submittedBy?: string; resubmit?: boolean } = {}
): Promise<EInvoiceSubmission> {
  const sql = SQL;
  await ensureEInvoiceTables(sql);
  const provider = opts.provider ?? "firs-sandbox";
  const adapter = PROVIDERS[provider];
  if (!adapter) throw new Error(`Unknown e-invoice provider '${provider}'`);

  const invoice = (await sql`
    select id, status, invoice_number, einvoice_status, einvoice_irn
    from finance_invoices where id = ${invoiceId} and tenant_slug = ${tenantSlug}
  `) as any[];
  const inv = invoice[0];
  if (!inv) throw new Error(`Invoice ${invoiceId} not found`);
  if (inv.status === "draft" || inv.status === "cancelled" || inv.status === "void") {
    throw new Error(`Cannot e-invoice a ${inv.status} invoice`);
  }
  if (inv.einvoice_status === "accepted" && !opts.resubmit) {
    const existing = await getEInvoiceStatus(tenantSlug, invoiceId);
    if (existing) return existing;
  }

  const doc = await generateEInvoice(tenantSlug, invoiceId);
  // FIRS IRN format: {invoiceNo}-{serviceId}-{yyyymmddhhmm}
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
  const irn = `${inv.invoice_number}-SYSERP-${stamp}`;

  let result: ProviderResult;
  try {
    result = await adapter(doc, irn, tenantSlug);
  } catch (err) {
    result = {
      status: "rejected",
      reference: irn,
      message: err instanceof Error ? err.message : "Provider call failed",
    };
  }

  const id = `esub_${randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();
  await sql`
    insert into einvoice_submissions (
      id, tenant_slug, invoice_id, provider, irn, status, payload, response,
      submitted_by, submitted_at, created_at
    ) values (
      ${id}, ${tenantSlug}, ${invoiceId}, ${provider}, ${irn}, ${result.status},
      ${JSON.stringify(doc)}, ${JSON.stringify(result)},
      ${opts.submittedBy ?? null}, ${now}, ${now}
    )
  `;
  await sql`
    update finance_invoices
    set einvoice_status = ${result.status}, einvoice_irn = ${irn}
    where id = ${invoiceId} and tenant_slug = ${tenantSlug}
  `;

  return {
    id,
    invoiceId,
    provider,
    irn,
    status: result.status,
    submittedBy: opts.submittedBy ?? null,
    submittedAt: now,
    response: result,
  };
}

export async function getEInvoiceStatus(
  tenantSlug: string,
  invoiceId: string
): Promise<EInvoiceSubmission | null> {
  const sql = SQL;
  await ensureEInvoiceTables(sql);
  const rows = (await sql`
    select * from einvoice_submissions
    where tenant_slug = ${tenantSlug} and invoice_id = ${invoiceId}
    order by submitted_at desc limit 1
  `) as any[];
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    invoiceId: r.invoice_id,
    provider: r.provider,
    irn: r.irn,
    status: r.status,
    submittedBy: r.submitted_by,
    submittedAt: r.submitted_at,
    response: typeof r.response === "string" ? JSON.parse(r.response) : r.response,
  };
}
