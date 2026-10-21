/**
 * Sales partners & commissions — mirrors ERPNext's Sales Partner and the
 * Sales Partners Commission report.
 *
 * Partners earn a % of the net invoice amount on invoices tagged with their
 * ID. Accrual posts Dr commission expense (6500) / Cr commission payable
 * (2350); payout posts Dr payable / Cr bank.
 */

import { db, sql as SQL } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { postGLEntry, GL_ACCOUNTS } from "./gl";

const COMMISSION_EXPENSE = "6500";
const COMMISSION_PAYABLE = "2350";

export function ensurePartnerTables() {
  return ensureOnce("finance/partners:tables", run);
}

async function run() {
  const sql = SQL;
  await sql`create table if not exists sales_partners (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    name text not null,
    partner_type text not null default 'agent' check (partner_type in ('agent','reseller','referrer','distributor')),
    commission_rate numeric not null,           -- % of net invoice amount
    email text, phone text, territory text,
    expense_account_code text not null default '6500',
    payable_account_code text not null default '2350',
    active boolean not null default true,
    created_at timestamptz not null default now(),
    unique (tenant_slug, name)
  )`;
  await sql`create table if not exists sales_partner_commissions (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    partner_id uuid not null references sales_partners(id) on delete cascade,
    invoice_id text not null,
    invoice_amount numeric not null,
    commission_rate numeric not null,
    commission_amount numeric not null,
    status text not null default 'accrued' check (status in ('accrued','paid','cancelled')),
    accrual_journal_entry_id text,
    payout_journal_entry_id text,
    paid_date date,
    created_at timestamptz not null default now(),
    unique (tenant_slug, partner_id, invoice_id)
  )`;
  await sql`alter table finance_invoices add column if not exists sales_partner_id uuid`;
}

export async function upsertSalesPartner(input: {
  tenantSlug: string; name: string; partnerType?: string;
  commissionRate: number; email?: string; phone?: string; territory?: string;
  expenseAccountCode?: string; payableAccountCode?: string; active?: boolean;
}) {
  await ensurePartnerTables();
  const rows = (await SQL`
    insert into sales_partners
      (tenant_slug, name, partner_type, commission_rate, email, phone, territory,
       expense_account_code, payable_account_code, active)
    values (${input.tenantSlug}, ${input.name}, ${input.partnerType ?? "agent"},
            ${input.commissionRate}, ${input.email ?? null}, ${input.phone ?? null},
            ${input.territory ?? null}, ${input.expenseAccountCode ?? COMMISSION_EXPENSE},
            ${input.payableAccountCode ?? COMMISSION_PAYABLE}, ${input.active ?? true})
    on conflict (tenant_slug, name) do update
      set commission_rate = excluded.commission_rate,
          partner_type = excluded.partner_type,
          active = excluded.active
    returning *
  `) as any[];
  return rows[0];
}

export async function listSalesPartners(tenantSlug: string) {
  await ensurePartnerTables();
  return (await SQL`
    select p.*, coalesce(c.accrued,0)::numeric total_accrued,
           coalesce(c.paid,0)::numeric total_paid
    from sales_partners p
    left join (
      select partner_id,
             sum(commission_amount) filter (where status = 'accrued') accrued,
             sum(commission_amount) filter (where status = 'paid') paid
      from sales_partner_commissions where tenant_slug = ${tenantSlug}
      group by partner_id
    ) c on c.partner_id = p.id
    where p.tenant_slug = ${tenantSlug} order by p.name
  `) as any[];
}

/** Tag an invoice with a sales partner and accrue their commission. */
export async function accrueCommission(input: {
  tenantSlug: string; invoiceId: string; partnerId: string; userId?: string;
}) {
  await ensurePartnerTables();
  const inv = (await SQL`
    select id, amount, status from finance_invoices
    where id = ${input.invoiceId} and tenant_slug = ${input.tenantSlug}
  `) as any[];
  if (!inv[0]) throw new Error("Invoice not found");
  if (["void", "draft"].includes(inv[0].status)) throw new Error("Cannot accrue on draft/void invoice");

  const partner = (await SQL`
    select * from sales_partners where id = ${input.partnerId} and tenant_slug = ${input.tenantSlug}
  `) as any[];
  if (!partner[0]) throw new Error("Sales partner not found");
  if (!partner[0].active) throw new Error("Sales partner inactive");

  const base = Number(inv[0].amount);
  const rate = Number(partner[0].commission_rate);
  const commission = Math.round(base * rate / 100 * 100) / 100;

  const je = await postGLEntry({
    tenantSlug: input.tenantSlug,
    entryDate: new Date().toISOString().slice(0, 10),
    journalType: "SYSTEM",
    referenceType: "sales_partner_commission",
    referenceId: input.invoiceId,
    description: `Commission accrual — ${partner[0].name} (${rate}% of invoice)`,
    createdBy: input.userId,
    lines: [
      { accountCode: partner[0].expense_account_code, debitAmount: commission, description: "Sales commission" },
      { accountCode: partner[0].payable_account_code, creditAmount: commission, partyType: "vendor", partyId: input.partnerId, description: "Commission payable" },
    ],
  });

  const rows = (await SQL`
    insert into sales_partner_commissions
      (tenant_slug, partner_id, invoice_id, invoice_amount, commission_rate,
       commission_amount, accrual_journal_entry_id)
    values (${input.tenantSlug}, ${input.partnerId}, ${input.invoiceId}, ${base}, ${rate},
            ${commission}, ${je.id})
    on conflict (tenant_slug, partner_id, invoice_id) do nothing
    returning *
  `) as any[];
  await SQL`update finance_invoices set sales_partner_id = ${input.partnerId} where id = ${input.invoiceId}`;
  return { ...(rows[0] ?? { invoice_id: input.invoiceId, commission_amount: commission, note: "already accrued" }), journalEntryId: je.id };
}

export async function payCommission(input: {
  tenantSlug: string; commissionId: string; bankAccountCode?: string;
  paidDate?: string; userId?: string;
}) {
  await ensurePartnerTables();
  const c = (await SQL`
    select c.*, p.payable_account_code, p.name partner_name
    from sales_partner_commissions c
    join sales_partners p on p.id = c.partner_id
    where c.id = ${input.commissionId} and c.tenant_slug = ${input.tenantSlug}
  `) as any[];
  if (!c[0]) throw new Error("Commission not found");
  if (c[0].status !== "accrued") throw new Error(`Commission is ${c[0].status}`);

  const amount = Number(c[0].commission_amount);
  const je = await postGLEntry({
    tenantSlug: input.tenantSlug,
    entryDate: input.paidDate ?? new Date().toISOString().slice(0, 10),
    journalType: "SYSTEM",
    referenceType: "sales_partner_payout",
    referenceId: input.commissionId,
    description: `Commission payout — ${c[0].partner_name}`,
    createdBy: input.userId,
    lines: [
      { accountCode: c[0].payable_account_code, debitAmount: amount, partyType: "vendor", partyId: c[0].partner_id, description: "Commission payable" },
      { accountCode: input.bankAccountCode ?? GL_ACCOUNTS.BANK, creditAmount: amount, description: "Payout" },
    ],
  });

  await SQL`
    update sales_partner_commissions
    set status = 'paid', payout_journal_entry_id = ${je.id},
        paid_date = ${input.paidDate ?? new Date().toISOString().slice(0, 10)}
    where id = ${input.commissionId}
  `;
  return { commissionId: input.commissionId, amount, journalEntryId: je.id };
}

/** ERPNext "Sales Partners Commission" report. */
export async function partnerCommissionReport(input: {
  tenantSlug: string; partnerId?: string; fromDate?: string; toDate?: string;
}) {
  await ensurePartnerTables();
  return (await SQL`
    select c.id, c.invoice_id, c.invoice_amount::numeric, c.commission_rate::numeric,
           c.commission_amount::numeric, c.status, c.paid_date::text, c.created_at::text,
           p.name partner_name, i.invoice_number, i.customer_name
    from sales_partner_commissions c
    join sales_partners p on p.id = c.partner_id
    left join finance_invoices i on i.id = c.invoice_id and i.tenant_slug = c.tenant_slug
    where c.tenant_slug = ${input.tenantSlug}
      ${input.partnerId ? SQL`and c.partner_id = ${input.partnerId}` : SQL``}
      ${input.fromDate ? SQL`and c.created_at >= ${input.fromDate}` : SQL``}
      ${input.toDate ? SQL`and c.created_at <= ${input.toDate}::date + 1` : SQL``}
    order by c.created_at desc
  `) as any[];
}
