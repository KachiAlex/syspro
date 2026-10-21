import { randomBytes, randomUUID } from "node:crypto";
import { sql as SQL } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";

export function ensurePortalTables(...args: Parameters<typeof ensurePortalTablesRun>) {
  return ensureOnce("finance/portal:ensurePortalTables", () => ensurePortalTablesRun(...args));
}

async function ensurePortalTablesRun(sql = SQL) {
  await sql`
    create table if not exists portal_tokens (
      id text primary key,
      tenant_slug text not null,
      party_type text not null,
      party_id text,
      party_name text not null,
      email text,
      token text not null unique,
      status text not null default 'active',
      expires_at timestamptz,
      last_accessed_at timestamptz,
      created_at timestamptz not null default now()
    )
  `;
}

export async function createPortalToken(
  tenantSlug: string,
  input: {
    partyType: "customer" | "vendor";
    partyId?: string;
    partyName: string;
    email?: string;
    expiresInDays?: number;
  }
): Promise<{ id: string; token: string; url: string }> {
  const sql = SQL;
  await ensurePortalTables(sql);
  const id = `ptok_${randomUUID().slice(0, 12)}`;
  const token = randomBytes(24).toString("base64url");
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 86400000).toISOString()
    : null;
  await sql`
    insert into portal_tokens (id, tenant_slug, party_type, party_id, party_name, email, token, status, expires_at, created_at)
    values (${id}, ${tenantSlug}, ${input.partyType}, ${input.partyId ?? null}, ${input.partyName},
            ${input.email ?? null}, ${token}, 'active', ${expiresAt}, now())
  `;
  return { id, token, url: `/api/portal/${token}` };
}

export async function listPortalTokens(
  tenantSlug: string,
  opts: { partyType?: string; partyId?: string } = {}
) {
  const sql = SQL;
  await ensurePortalTables(sql);
  const rows = (await sql`
    select id, party_type, party_id, party_name, email, status, expires_at, last_accessed_at, created_at
    from portal_tokens
    where tenant_slug = ${tenantSlug}
      and (${opts.partyType ?? null}::text is null or party_type = ${opts.partyType ?? null})
      and (${opts.partyId ?? null}::text is null or party_id = ${opts.partyId ?? null})
    order by created_at desc
  `) as any[];
  return rows;
}

export async function revokePortalToken(tenantSlug: string, tokenId: string): Promise<void> {
  const sql = SQL;
  await sql`
    update portal_tokens set status = 'revoked'
    where id = ${tokenId} and tenant_slug = ${tenantSlug}
  `;
}

/**
 * Resolve a portal token into the party's read-only document set.
 * The token is the only credential — no tenant auth on this path.
 */
export async function portalView(token: string): Promise<
  | { error: string; status: number }
  | {
      partyType: "customer" | "vendor";
      partyName: string;
      tenantSlug: string;
      invoices?: any[];
      payments?: any[];
      bills?: any[];
      purchaseOrders?: any[];
      totals: Record<string, number>;
    }
> {
  const sql = SQL;
  await ensurePortalTables(sql);
  const rows = (await sql`
    select * from portal_tokens
    where token = ${token} and status = 'active'
      and (expires_at is null or expires_at > now())
  `) as any[];
  const t = rows[0];
  if (!t) return { error: "Invalid or expired portal link", status: 404 };

  await sql`update portal_tokens set last_accessed_at = now() where id = ${t.id}`;

  const tenant = t.tenant_slug;
  const partyName = t.party_name;
  const partyId = t.party_id;

  if (t.party_type === "customer") {
    const invoices = (await sql`
      select id, invoice_number, issued_date, due_date, currency, amount, balance_due, status
      from finance_invoices
      where tenant_slug = ${tenant}
        and (customer_code = ${partyId ?? ""} or customer_name = ${partyName})
      order by issued_date desc limit 200
    `) as any[];
    const invoiceIds = invoices.map((i: any) => i.id);
    const payments = invoiceIds.length
      ? ((await sql`
          select id, invoice_id, payment_date, gross_amount, method, reference
          from finance_payments
          where tenant_slug = ${tenant} and invoice_id = any(${invoiceIds}::text[])
          order by payment_date desc
        `) as any[])
      : [];
    return {
      partyType: "customer",
      partyName,
      tenantSlug: tenant,
      invoices: invoices.map((i: any) => ({
        id: i.id, invoiceNumber: i.invoice_number, issuedDate: i.issued_date,
        dueDate: i.due_date, currency: i.currency,
        amount: Number(i.amount), balanceDue: Number(i.balance_due), status: i.status,
      })),
      payments: payments.map((p: any) => ({
        id: p.id, invoiceId: p.invoice_id, date: p.payment_date,
        amount: Number(p.gross_amount), method: p.method, reference: p.reference,
      })),
      totals: {
        invoiced: invoices.reduce((s: number, i: any) => s + Number(i.amount), 0),
        outstanding: invoices.reduce((s: number, i: any) => s + Number(i.balance_due), 0),
        paid: payments.reduce((s: number, p: any) => s + Number(p.gross_amount), 0),
      },
    };
  }

  // vendor portal — bills key vendor_id (uuid); resolve name via vendors join
  const bills = (await sql`
    select b.id, b.bill_number, b.bill_date, b.due_date, b.currency, b.total, b.balance_due, b.status
    from bills b
    left join vendors v on v.tenant_slug = b.tenant_slug and v.id::text = b.vendor_id::text
    where b.tenant_slug = ${tenant}
      and (b.vendor_id::text = ${partyId ?? ""} or v.name = ${partyName} or v.display_name = ${partyName})
    order by b.bill_date desc limit 200
  `) as any[];
  let purchaseOrders: any[] = [];
  try {
    purchaseOrders = (await sql`
      select id, coalesce(po_number, order_number, id) as po_number, coalesce(issued_date::text, order_date) as order_date, status, coalesce(total_amount, total) as total
      from purchase_orders
      where tenant_slug = ${tenant}
        and (vendor_id = ${partyId ?? ""} or supplier_id = ${partyId ?? ""} or supplier_name = ${partyName})
      order by created_at desc limit 200
    `) as any[];
  } catch {
    purchaseOrders = [];
  }
  return {
    partyType: "vendor",
    partyName,
    tenantSlug: tenant,
    bills: bills.map((b: any) => ({
      id: b.id, billNumber: b.bill_number, billDate: b.bill_date, dueDate: b.due_date,
      currency: b.currency, total: Number(b.total), balanceDue: Number(b.balance_due), status: b.status,
    })),
    purchaseOrders: (purchaseOrders as any[]).map((p: any) => ({
      id: p.id, poNumber: p.po_number, orderDate: p.order_date, total: Number(p.total), status: p.status,
    })),
    totals: {
      billed: bills.reduce((s: number, b: any) => s + Number(b.total), 0),
      outstanding: bills.reduce((s: number, b: any) => s + Number(b.balance_due), 0),
    },
  };
}
