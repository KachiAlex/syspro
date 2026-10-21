import { randomUUID } from "crypto";

import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { postGLEntry, GL_ACCOUNTS } from "./gl";

// ---------------------------------------------------------------------------
// Fixed assets: register, depreciation schedule (straight-line /
// reducing-balance), period depreciation runs posting JEs, and disposals
// with gain/loss recognition. All GL-integrated on tenant_slug.
// ---------------------------------------------------------------------------

export function ensureAssetTables() {
  return ensureOnce("finance/fixed-assets:ensureTables", ensureAssetTablesRun);
}

async function ensureAssetTablesRun() {
  const sql = SQL;
  await sql`
    create table if not exists fixed_assets (
      id text primary key,
      tenant_slug text not null,
      asset_no text not null,
      name text not null,
      category text,
      acquisition_date date not null,
      cost numeric not null,
      salvage_value numeric not null default 0,
      useful_life_months integer not null,
      method text not null default 'straight_line',
      depreciation_start_date date not null,
      accumulated_depreciation numeric not null default 0,
      net_book_value numeric not null,
      asset_account_code text not null default '1600',
      dep_expense_account_code text not null default '6400',
      accum_dep_account_code text not null default '1700',
      status text not null default 'active',
      disposal_date date,
      disposal_method text,
      disposal_proceeds numeric,
      disposal_journal_entry_id text,
      metadata jsonb,
      created_at timestamptz not null default now(),
      unique (tenant_slug, asset_no)
    )
  `;
  await sql`
    create table if not exists asset_depreciation_schedule (
      id uuid primary key default gen_random_uuid(),
      tenant_slug text not null,
      asset_id text not null references fixed_assets (id) on delete cascade,
      period_date date not null,
      amount numeric not null,
      status text not null default 'pending',
      journal_entry_id text,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists fad_asset_idx on asset_depreciation_schedule (tenant_slug, asset_id, period_date)`;
  await sql`create index if not exists fixed_assets_tenant_idx on fixed_assets (tenant_slug, status)`;
}

async function nextAssetNo(tenantSlug: string): Promise<string> {
  const rows = (await SQL`
    select count(*)::int n from fixed_assets where tenant_slug = ${tenantSlug}
  `) as any[];
  return `FA-${String((rows[0]?.n ?? 0) + 1).padStart(4, "0")}`;
}

/** Monthly straight-line; reducing-balance uses 2/life annual rate on NBV. */
function buildSchedule(input: {
  cost: number;
  salvage: number;
  lifeMonths: number;
  method: "straight_line" | "reducing_balance";
  startDate: string;
}): Array<{ periodDate: string; amount: number }> {
  const schedule: Array<{ periodDate: string; amount: number }> = [];
  const [y, m] = input.startDate.split("-").map(Number);
  let nbv = input.cost;
  const depreciable = input.cost - input.salvage;

  for (let i = 1; i <= input.lifeMonths; i++) {
    const d = new Date(Date.UTC(y, m - 1 + i, 0)); // last day of period month
    const periodDate = d.toISOString().slice(0, 10);
    let amount: number;
    if (input.method === "reducing_balance") {
      // Double-declining on current NBV, never below salvage.
      const monthlyRate = (2 / input.lifeMonths);
      amount = Math.min(nbv * monthlyRate, nbv - input.salvage);
      if (i === input.lifeMonths) amount = nbv - input.salvage;
    } else {
      amount = i === input.lifeMonths
        ? depreciable - (depreciable / input.lifeMonths) * (input.lifeMonths - 1)
        : depreciable / input.lifeMonths;
    }
    amount = Math.round(amount * 100) / 100;
    if (amount <= 0) break;
    nbv = Math.round((nbv - amount) * 100) / 100;
    schedule.push({ periodDate, amount });
    if (nbv <= input.salvage + 0.005) break;
  }
  return schedule;
}

export async function createAsset(input: {
  tenantSlug: string;
  name: string;
  category?: string;
  acquisitionDate: string;
  cost: number;
  salvageValue?: number;
  usefulLifeMonths: number;
  method?: "straight_line" | "reducing_balance";
  depreciationStartDate?: string;
  assetAccountCode?: string;
  depExpenseAccountCode?: string;
  accumDepAccountCode?: string;
  metadata?: Record<string, unknown>;
}) {
  await ensureAssetTables();
  if (input.cost <= 0) throw new Error("Asset cost must be positive");
  if (input.usefulLifeMonths < 1) throw new Error("Useful life must be at least 1 month");
  const salvage = input.salvageValue ?? 0;
  if (salvage >= input.cost) throw new Error("Salvage value must be less than cost");

  const id = `fa_${randomUUID().slice(0, 12)}`;
  const assetNo = await nextAssetNo(input.tenantSlug);
  const start = input.depreciationStartDate ?? input.acquisitionDate;
  const method = input.method ?? "straight_line";

  await SQL`
    insert into fixed_assets (
      id, tenant_slug, asset_no, name, category, acquisition_date, cost,
      salvage_value, useful_life_months, method, depreciation_start_date,
      accumulated_depreciation, net_book_value,
      asset_account_code, dep_expense_account_code, accum_dep_account_code,
      status, metadata
    ) values (
      ${id}, ${input.tenantSlug}, ${assetNo}, ${input.name}, ${input.category ?? null},
      ${input.acquisitionDate}, ${input.cost}, ${salvage}, ${input.usefulLifeMonths},
      ${method}, ${start}, 0, ${input.cost},
      ${input.assetAccountCode ?? "1600"},
      ${input.depExpenseAccountCode ?? GL_ACCOUNTS.DEPRECIATION_EXPENSE},
      ${input.accumDepAccountCode ?? GL_ACCOUNTS.ACCUMULATED_DEPRECIATION},
      'active', ${input.metadata ? JSON.stringify(input.metadata) : null}
    )
  `;

  const schedule = buildSchedule({
    cost: input.cost, salvage, lifeMonths: input.usefulLifeMonths,
    method, startDate: start,
  });
  for (const row of schedule) {
    await SQL`
      insert into asset_depreciation_schedule (tenant_slug, asset_id, period_date, amount)
      values (${input.tenantSlug}, ${id}, ${row.periodDate}, ${row.amount})
    `;
  }

  return { id, assetNo, scheduleRows: schedule.length };
}

export async function listAssets(tenantSlug: string, status?: string) {
  await ensureAssetTables();
  return (await SQL`
    select * from fixed_assets
    where tenant_slug = ${tenantSlug}
      ${status ? SQL`and status = ${status}` : SQL``}
    order by asset_no
  `) as any[];
}

export async function getAssetSchedule(tenantSlug: string, assetId: string) {
  await ensureAssetTables();
  return (await SQL`
    select * from asset_depreciation_schedule
    where tenant_slug = ${tenantSlug} and asset_id = ${assetId}
    order by period_date
  `) as any[];
}

/**
 * Posts all due, unposted depreciation rows up to `asOf`. One JE per row:
 * Dr depreciation expense / Cr accumulated depreciation. Returns posted rows.
 */
export async function runDepreciation(input: {
  tenantSlug: string;
  asOf?: string;
  userId?: string;
}) {
  await ensureAssetTables();
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);

  const due = (await SQL`
    select s.id, s.asset_id, s.period_date::text as period_date, s.amount,
           a.asset_no, a.name, a.dep_expense_account_code, a.accum_dep_account_code
    from asset_depreciation_schedule s
    join fixed_assets a on a.id = s.asset_id and a.tenant_slug = s.tenant_slug
    where s.tenant_slug = ${input.tenantSlug}
      and s.status = 'pending'
      and s.period_date <= ${asOf}
      and a.status = 'active'
    order by s.period_date
  `) as any[];

  const posted: Array<{ scheduleId: string; assetNo: string; amount: number; journalEntryId: string }> = [];
  for (const row of due) {
    const amt = Number(row.amount);
    const je = await postGLEntry({
      tenantSlug: input.tenantSlug,
      entryDate: String(row.period_date).slice(0, 10),
      journalType: "SYSTEM",
      referenceType: "asset_depreciation",
      referenceId: row.asset_id,
      description: `Depreciation ${row.asset_no} ${row.name} — ${String(row.period_date).slice(0, 7)}`,
      createdBy: input.userId,
      lines: [
        { accountCode: row.dep_expense_account_code, debitAmount: amt, description: "Depreciation" },
        { accountCode: row.accum_dep_account_code, creditAmount: amt, description: "Accumulated depreciation" },
      ],
    });
    await SQL`
      update asset_depreciation_schedule set status = 'posted', journal_entry_id = ${je.id}
      where id = ${row.id}
    `;
    await SQL`
      update fixed_assets
      set accumulated_depreciation = accumulated_depreciation + ${amt},
          net_book_value = net_book_value - ${amt},
          status = case when net_book_value - ${amt} <= salvage_value + 0.005
                        then 'fully_depreciated' else 'active' end
      where id = ${row.asset_id} and tenant_slug = ${input.tenantSlug}
    `;
    posted.push({ scheduleId: row.id, assetNo: row.asset_no, amount: amt, journalEntryId: je.id });
  }
  return { asOf, posted };
}

/**
 * Disposes an asset: removes NBV, books proceeds, and posts the gain/loss.
 * JE: Dr proceeds-account (if any) + Dr accumulated depreciation + Dr loss
 *     Cr asset cost + Cr gain
 */
export async function disposeAsset(input: {
  tenantSlug: string;
  assetId: string;
  disposalDate: string;
  method: "sale" | "scrap" | "donation" | "write_off";
  proceeds?: number;
  proceedsAccountCode?: string;
  userId?: string;
}) {
  await ensureAssetTables();
  const rows = (await SQL`
    select * from fixed_assets where id = ${input.assetId} and tenant_slug = ${input.tenantSlug}
  `) as any[];
  const asset = rows[0];
  if (!asset) throw new Error(`Asset ${input.assetId} not found`);
  if (asset.status === "disposed") throw new Error("Asset already disposed");

  const cost = Number(asset.cost);
  const accum = Number(asset.accumulated_depreciation);
  const nbv = Math.round((cost - accum) * 100) / 100;
  const proceeds = input.proceeds ?? 0;
  // gain = proceeds - NBV (positive → credit; negative → debit as loss)
  const gainLoss = Math.round((proceeds - nbv) * 100) / 100;

  const lines: any[] = [];
  if (proceeds > 0) {
    lines.push({
      accountCode: input.proceedsAccountCode ?? GL_ACCOUNTS.BANK,
      debitAmount: proceeds, description: `Disposal proceeds — ${input.method}`,
    });
  }
  if (accum > 0) {
    lines.push({
      accountCode: asset.accum_dep_account_code,
      debitAmount: accum, description: "Remove accumulated depreciation",
    });
  }
  if (gainLoss < 0) {
    lines.push({
      accountCode: GL_ACCOUNTS.GAIN_LOSS_DISPOSAL,
      debitAmount: Math.abs(gainLoss), description: "Loss on disposal",
    });
  }
  lines.push({
    accountCode: asset.asset_account_code,
    creditAmount: cost, description: "Derecognize asset at cost",
  });
  if (gainLoss > 0) {
    lines.push({
      accountCode: GL_ACCOUNTS.GAIN_LOSS_DISPOSAL,
      creditAmount: gainLoss, description: "Gain on disposal",
    });
  }

  const je = await postGLEntry({
    tenantSlug: input.tenantSlug,
    entryDate: input.disposalDate,
    journalType: "SYSTEM",
    referenceType: "asset_disposal",
    referenceId: input.assetId,
    description: `Disposal of ${asset.asset_no} ${asset.name} (${input.method})`,
    createdBy: input.userId,
    lines,
  });

  await SQL`
    update fixed_assets
    set status = 'disposed', disposal_date = ${input.disposalDate},
        disposal_method = ${input.method}, disposal_proceeds = ${proceeds},
        disposal_journal_entry_id = ${je.id}, net_book_value = 0
    where id = ${input.assetId} and tenant_slug = ${input.tenantSlug}
  `;
  await SQL`
    update asset_depreciation_schedule set status = 'cancelled'
    where asset_id = ${input.assetId} and tenant_slug = ${input.tenantSlug} and status = 'pending'
  `;

  return { journalEntryId: je.id, netBookValue: nbv, gainLoss };
}
