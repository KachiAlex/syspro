/**
 * Cheque print templates — mirrors ERPNext's Cheque Print Template.
 * A template positions each field (date, payee, amount words/figures, account
 * no) on a scanned cheque image so payments print exactly where the bank's
 * cheque stock expects them.
 */

import { sql as SQL } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";

export function ensureChequeTables() {
  return ensureOnce("finance/cheque:tables", run);
}

async function run() {
  const sql = SQL;
  await sql`create table if not exists cheque_print_templates (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    name text not null,
    bank text,
    -- all coordinates in mm from top-left of the cheque leaf
    fields jsonb not null,           -- { date:{x,y,format}, payee:{x,y}, amount_figures:{x,y}, amount_words:{x,y,x2}, account_no:{x,y}, cheque_size:{w,h} }
    scan_url text,                   -- optional background image of the cheque
    is_default boolean not null default false,
    created_at timestamptz not null default now(),
    unique (tenant_slug, name)
  )`;
}

export type ChequeFieldSpec = {
  x: number; y: number;
  format?: string;                   // date format e.g. "DDMMYYYY"
  x2?: number;                       // second line x for amount_words wrap
  y2?: number;
};

export type ChequeFieldMap = {
  date?: ChequeFieldSpec;
  payee?: ChequeFieldSpec;
  amount_figures?: ChequeFieldSpec;
  amount_words?: ChequeFieldSpec;
  account_no?: ChequeFieldSpec;
  signature?: ChequeFieldSpec;
  cheque_size?: { w: number; h: number };
};

export async function upsertChequeTemplate(input: {
  tenantSlug: string; name: string; bank?: string; fields: ChequeFieldMap;
  scanUrl?: string; isDefault?: boolean;
}) {
  await ensureChequeTables();
  if (input.isDefault) {
    await SQL`update cheque_print_templates set is_default = false where tenant_slug = ${input.tenantSlug}`;
  }
  const rows = (await SQL`
    insert into cheque_print_templates (tenant_slug, name, bank, fields, scan_url, is_default)
    values (${input.tenantSlug}, ${input.name}, ${input.bank ?? null},
            ${JSON.stringify(input.fields)}::jsonb, ${input.scanUrl ?? null}, ${input.isDefault ?? false})
    on conflict (tenant_slug, name) do update
      set bank = excluded.bank, fields = excluded.fields,
          scan_url = excluded.scan_url, is_default = excluded.is_default
    returning *
  `) as any[];
  return rows[0];
}

export async function listChequeTemplates(tenantSlug: string) {
  await ensureChequeTables();
  return (await SQL`select * from cheque_print_templates where tenant_slug = ${tenantSlug} order by is_default desc, name`) as any[];
}

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function words999(n: number): string {
  const out: string[] = [];
  if (n >= 100) { out.push(`${ONES[Math.floor(n / 100)]} hundred`); n %= 100; if (n) out.push("and"); }
  if (n >= 20) { out.push(TENS[Math.floor(n / 10)]); if (n % 10) out.push(ONES[n % 10]); }
  else if (n > 0) out.push(ONES[n]);
  return out.join(" ");
}

export function amountInWords(amount: number, currency = "Naira"): string {
  if (amount < 0) return `minus ${amountInWords(-amount, currency)}`;
  const naira = Math.floor(amount);
  const kobo = Math.round((amount - naira) * 100);
  const groups: Array<[number, string]> = [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"]];
  const parts: string[] = [];
  let rest = naira;
  for (const [div, label] of groups) {
    const g = Math.floor(rest / div);
    if (g) parts.push(`${words999(g)} ${label}`);
    rest %= div;
  }
  if (rest) parts.push(words999(rest));
  let words = parts.length ? parts.join(" ") : "zero";
  words = words.charAt(0).toUpperCase() + words.slice(1);
  words += ` ${currency}`;
  if (kobo) words += `, ${words999(kobo)} kobo`;
  return `${words} only`;
}

/**
 * Merge a payment's data into a template → print-ready absolute positions.
 * The caller renders fields at mm coordinates over the scan image.
 */
export async function renderCheque(input: {
  tenantSlug: string; templateId?: string;
  payee: string; amount: number; date: string;
  accountNo?: string; currency?: string;
}) {
  await ensureChequeTables();
  const t = input.templateId
    ? (await SQL`select * from cheque_print_templates where id = ${input.templateId} and tenant_slug = ${input.tenantSlug}`) as any[]
    : (await SQL`select * from cheque_print_templates where tenant_slug = ${input.tenantSlug} and is_default limit 1`) as any[];
  if (!t[0]) throw new Error(input.templateId ? "Template not found" : "No default cheque template");
  const fields: ChequeFieldMap = t[0].fields;
  const dateFmt = fields.date?.format ?? "DDMMYYYY";
  const digits = input.date.replace(/-/g, "");
  const formatted = dateFmt === "DDMMYYYY"
    ? `${digits.slice(6, 8)}${digits.slice(4, 6)}${digits.slice(0, 4)}`
    : input.date;
  return {
    template: { id: t[0].id, name: t[0].name, bank: t[0].bank, scanUrl: t[0].scan_url, size: fields.cheque_size },
    positions: {
      date: fields.date ? { ...fields.date, text: formatted } : undefined,
      payee: fields.payee ? { ...fields.payee, text: input.payee } : undefined,
      amount_figures: fields.amount_figures
        ? { ...fields.amount_figures, text: `=${input.amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}=` }
        : undefined,
      amount_words: fields.amount_words
        ? { ...fields.amount_words, text: amountInWords(input.amount, input.currency ?? "Naira") }
        : undefined,
      account_no: fields.account_no ? { ...fields.account_no, text: input.accountNo ?? "" } : undefined,
      signature: fields.signature,
    },
  };
}
