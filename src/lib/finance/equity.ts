/**
 * Equity accounting — shareholders, share types, transfers, and the share
 * ledger. Mirrors ERPNext's Shareholder / Share Transfer / Share Balance.
 *
 * GL postings:
 *   Issue    Dr bank (1100)          Cr share capital (3201 or type account)
 *   Transfer Dr capital (transferor) Cr capital (transferee)  — equity reclass
 *   Purchase Dr capital              Cr bank                  — buy-back
 * Premium above face value goes to share premium (3202).
 */

import { db, sql as SQL } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { postGLEntry, GL_ACCOUNTS } from "./gl";

export const EQUITY_ACCOUNTS = {
  SHARE_CAPITAL: "3210",
  SHARE_PREMIUM: "3220",
} as const;

export function ensureEquityTables() {
  return ensureOnce("finance/equity:tables", run);
}

async function run() {
  const sql = SQL;
  await sql`create table if not exists share_types (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    name text not null,
    face_value numeric not null,
    premium numeric not null default 0,
    capital_account_code text not null default '3210',
    premium_account_code text not null default '3220',
    unique (tenant_slug, name)
  )`;
  await sql`create table if not exists shareholders (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    name text not null,
    email text,
    address text,
    folio_no text,
    created_at timestamptz not null default now(),
    unique (tenant_slug, name)
  )`;
  await sql`create table if not exists share_transfers (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    transfer_type text not null check (transfer_type in ('issue','purchase','transfer')),
    share_type_id uuid not null references share_types(id),
    from_shareholder_id uuid references shareholders(id),
    to_shareholder_id uuid references shareholders(id),
    qty numeric not null,
    rate numeric not null,               -- per-share consideration
    posting_date date not null,
    bank_account_code text not null default '1100',
    journal_entry_id text,
    status text not null default 'posted' check (status in ('posted','cancelled')),
    created_at timestamptz not null default now()
  )`;
  await sql`create index if not exists share_transfers_idx on share_transfers (tenant_slug, posting_date)`;
}

export async function upsertShareType(input: {
  tenantSlug: string; name: string; faceValue: number; premium?: number;
  capitalAccountCode?: string; premiumAccountCode?: string;
}) {
  await ensureEquityTables();
  const rows = (await SQL`
    insert into share_types (tenant_slug, name, face_value, premium, capital_account_code, premium_account_code)
    values (${input.tenantSlug}, ${input.name}, ${input.faceValue}, ${input.premium ?? 0},
            ${input.capitalAccountCode ?? EQUITY_ACCOUNTS.SHARE_CAPITAL},
            ${input.premiumAccountCode ?? EQUITY_ACCOUNTS.SHARE_PREMIUM})
    on conflict (tenant_slug, name) do update
      set face_value = excluded.face_value, premium = excluded.premium
    returning *
  `) as any[];
  return rows[0];
}

export async function listShareTypes(tenantSlug: string) {
  await ensureEquityTables();
  return (await SQL`select * from share_types where tenant_slug = ${tenantSlug} order by name`) as any[];
}

export async function upsertShareholder(input: {
  tenantSlug: string; name: string; email?: string; address?: string; folioNo?: string;
}) {
  await ensureEquityTables();
  const rows = (await SQL`
    insert into shareholders (tenant_slug, name, email, address, folio_no)
    values (${input.tenantSlug}, ${input.name}, ${input.email ?? null}, ${input.address ?? null}, ${input.folioNo ?? null})
    on conflict (tenant_slug, name) do update
      set email = coalesce(excluded.email, shareholders.email),
          address = coalesce(excluded.address, shareholders.address)
    returning *
  `) as any[];
  return rows[0];
}

export async function listShareholders(tenantSlug: string) {
  await ensureEquityTables();
  return (await SQL`select * from shareholders where tenant_slug = ${tenantSlug} order by name`) as any[];
}

/**
 * Record a share transfer. Posts GL:
 *   issue    → Dr bank, Cr capital + premium
 *   purchase → Dr capital (+premium pro-rata), Cr bank
 *   transfer → equity reclassification between shareholders' ledger (GL still
 *              posts capital→capital so the share ledger reconciles to GL)
 */
export async function recordShareTransfer(input: {
  tenantSlug: string;
  transferType: "issue" | "purchase" | "transfer";
  shareTypeId: string;
  fromShareholderId?: string;   // required for purchase/transfer
  toShareholderId?: string;     // required for issue/transfer
  qty: number;
  rate: number;                 // consideration per share
  postingDate: string;
  bankAccountCode?: string;
  userId?: string;
}) {
  await ensureEquityTables();
  if (input.qty <= 0) throw new Error("Quantity must be positive");
  if (input.rate < 0) throw new Error("Rate cannot be negative");
  if (input.transferType !== "issue" && !input.fromShareholderId) {
    throw new Error("fromShareholderId required for purchase/transfer");
  }
  if (input.transferType !== "purchase" && !input.toShareholderId) {
    throw new Error("toShareholderId required for issue/transfer");
  }

  const st = (await SQL`
    select * from share_types where id = ${input.shareTypeId} and tenant_slug = ${input.tenantSlug}
  `) as any[];
  if (!st[0]) throw new Error("Share type not found");
  const shareType = st[0];
  const bank = input.bankAccountCode ?? GL_ACCOUNTS.BANK;
  const capital = shareType.capital_account_code;
  const premiumAcct = shareType.premium_account_code;
  const faceTotal = input.qty * Number(shareType.face_value);
  const premiumPerShare = Number(shareType.premium);
  const consideration = input.qty * input.rate;

  const lines: any[] = [];
  const t = input.transferType;
  if (t === "issue") {
    lines.push({ accountCode: bank, debitAmount: consideration, description: "Share issue proceeds" });
    lines.push({ accountCode: capital, creditAmount: faceTotal, description: `Share capital — ${input.qty} @ ${shareType.face_value}` });
    const prem = consideration - faceTotal;
    if (prem > 0.004) {
      lines.push({ accountCode: premiumAcct, creditAmount: Math.round(prem * 100) / 100, description: "Share premium" });
    } else if (prem < -0.004) {
      lines.push({ accountCode: capital, debitAmount: Math.round(-prem * 100) / 100, description: "Discount on issue" });
    }
  } else if (t === "purchase") {
    lines.push({ accountCode: capital, debitAmount: faceTotal, description: "Share buy-back" });
    const excess = consideration - faceTotal;
    if (excess > 0.004) {
      lines.push({ accountCode: premiumAcct, debitAmount: Math.round(excess * 100) / 100, description: "Premium on buy-back" });
    }
    lines.push({ accountCode: bank, creditAmount: consideration, description: "Buy-back consideration" });
  } else {
    // transfer: capital moves between shareholders — net-zero GL, keeps subledger honest
    lines.push({ accountCode: capital, debitAmount: faceTotal, partyType: "other", partyId: input.fromShareholderId, description: "Shares transferred out" });
    lines.push({ accountCode: capital, creditAmount: faceTotal, partyType: "other", partyId: input.toShareholderId, description: "Shares transferred in" });
  }

  const je = await postGLEntry({
    tenantSlug: input.tenantSlug,
    entryDate: input.postingDate,
    journalType: "SYSTEM",
    referenceType: "share_transfer",
    description: `Share ${t} — ${input.qty} × ${shareType.name}`,
    createdBy: input.userId,
    lines,
  });

  const rows = (await SQL`
    insert into share_transfers
      (tenant_slug, transfer_type, share_type_id, from_shareholder_id, to_shareholder_id,
       qty, rate, posting_date, bank_account_code, journal_entry_id)
    values (${input.tenantSlug}, ${t}, ${input.shareTypeId},
            ${input.fromShareholderId ?? null}, ${input.toShareholderId ?? null},
            ${input.qty}, ${input.rate}, ${input.postingDate}, ${bank}, ${je.id})
    returning *
  `) as any[];
  return { ...rows[0], journalEntryId: je.id };
}

/** ERPNext Share Ledger — every share movement with running balance per party. */
export async function shareLedger(input: {
  tenantSlug: string; shareholderId?: string; shareTypeId?: string;
}) {
  await ensureEquityTables();
  const rows = (await SQL`
    select t.id, t.transfer_type, t.posting_date::text, t.qty, t.rate, t.status,
           st.name share_type, st.face_value,
           fs.name from_name, ts.name to_name,
           coalesce(t.to_shareholder_id, t.from_shareholder_id) shareholder_id,
           coalesce(ts.name, fs.name) shareholder
    from share_transfers t
    join share_types st on st.id = t.share_type_id
    left join shareholders fs on fs.id = t.from_shareholder_id
    left join shareholders ts on ts.id = t.to_shareholder_id
    where t.tenant_slug = ${input.tenantSlug}
      ${input.shareholderId ? SQL`and (t.from_shareholder_id = ${input.shareholderId} or t.to_shareholder_id = ${input.shareholderId})` : SQL``}
      ${input.shareTypeId ? SQL`and t.share_type_id = ${input.shareTypeId}` : SQL``}
    order by t.posting_date, t.created_at
  `) as any[];

  return rows.map((r) => ({
    id: r.id,
    date: r.posting_date?.slice(0, 10),
    transferType: r.transfer_type,
    shareType: r.share_type,
    shareholder: r.shareholder,
    qty: r.transfer_type === "purchase" ? -Number(r.qty) : Number(r.qty),
    rate: Number(r.rate),
    amount: Number(r.qty) * Number(r.rate),
    status: r.status,
  }));
}

/** ERPNext Share Balance — shares held per shareholder per type. */
export async function shareBalance(tenantSlug: string) {
  await ensureEquityTables();
  const rows = (await SQL`
    select s.id shareholder_id, s.name shareholder, st.id share_type_id, st.name share_type,
           st.face_value,
           coalesce(sum(case
             when t.status = 'cancelled' then 0
             when t.to_shareholder_id = s.id then t.qty
             when t.from_shareholder_id = s.id then -t.qty
             else 0 end), 0)::numeric shares
    from shareholders s
    cross join share_types st
    left join share_transfers t
      on t.tenant_slug = s.tenant_slug and t.share_type_id = st.id
      and (t.to_shareholder_id = s.id or t.from_shareholder_id = s.id)
    where s.tenant_slug = ${tenantSlug} and st.tenant_slug = ${tenantSlug}
    group by s.id, s.name, st.id, st.name, st.face_value
    having coalesce(sum(case
             when t.status = 'cancelled' then 0
             when t.to_shareholder_id = s.id then t.qty
             when t.from_shareholder_id = s.id then -t.qty
             else 0 end), 0) != 0
    order by s.name, st.name
  `) as any[];
  return rows.map((r) => ({
    shareholderId: r.shareholder_id,
    shareholder: r.shareholder,
    shareType: r.share_type,
    shares: Number(r.shares),
    faceValue: Number(r.face_value),
    capitalValue: Math.round(Number(r.shares) * Number(r.face_value) * 100) / 100,
  }));
}
