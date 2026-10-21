import { randomUUID } from "crypto";

import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { postGLEntry, GL_ACCOUNTS } from "./gl";
import { ensureAssetTables, createAsset } from "./fixed-assets";

// ---------------------------------------------------------------------------
// Asset lifecycle (ERPNext Assets workspace parity): locations & movements,
// maintenance teams/schedules/log (incl. repairs), value adjustments
// (revaluation/impairment), and capitalization of cost pools into assets —
// all GL-integrated through postGLEntry on tenant_slug.
// ---------------------------------------------------------------------------

export function ensureAssetLifecycleTables() {
  return ensureOnce("finance/asset-lifecycle:ensureTables", async () => {
    await ensureAssetTables();
    const sql = SQL;
    await sql`alter table if exists fixed_assets add column if not exists location text`;
    await sql`alter table if exists fixed_assets add column if not exists custodian text`;
    await sql`alter table if exists fixed_assets add column if not exists finance_book text not null default 'main'`;
    await sql`alter table if exists asset_depreciation_schedule add column if not exists finance_book text not null default 'main'`;

    await sql`
      create table if not exists asset_maintenance_teams (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        name text not null,
        members jsonb not null default '[]'::jsonb,
        created_at timestamptz not null default now(),
        unique (tenant_slug, name)
      )`;

    await sql`
      create table if not exists asset_maintenance (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        asset_id text not null references fixed_assets (id) on delete cascade,
        kind text not null default 'preventive',
        team_name text,
        status text not null default 'scheduled',
        scheduled_date date,
        completed_date date,
        description text,
        cost numeric not null default 0,
        journal_entry_id text,
        created_at timestamptz not null default now()
      )`;
    await sql`create index if not exists asset_maint_idx on asset_maintenance (tenant_slug, asset_id, status)`;

    await sql`
      create table if not exists asset_movements (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        asset_id text not null references fixed_assets (id) on delete cascade,
        from_location text,
        to_location text,
        custodian text,
        moved_at timestamptz not null default now(),
        notes text
      )`;
    await sql`create index if not exists asset_move_idx on asset_movements (tenant_slug, asset_id)`;

    await sql`
      create table if not exists asset_value_adjustments (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        asset_id text not null references fixed_assets (id) on delete cascade,
        adjustment_date date not null,
        old_nbv numeric not null,
        new_nbv numeric not null,
        delta numeric not null,
        reason text,
        journal_entry_id text,
        created_by text,
        created_at timestamptz not null default now()
      )`;

    await sql`
      create table if not exists asset_capitalizations (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        asset_id text references fixed_assets (id) on delete set null,
        capitalization_date date not null,
        source_account_code text not null,
        amount numeric not null,
        journal_entry_id text,
        created_at timestamptz not null default now()
      )`;

    await sql`alter table if exists asset_maintenance add column if not exists parts jsonb not null default '[]'::jsonb`;
    await sql`alter table if exists asset_maintenance add column if not exists purchase_invoice_id text`;

    await sql`
      create table if not exists asset_locations (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        name text not null,
        parent_name text,
        created_at timestamptz not null default now(),
        unique (tenant_slug, name)
      )`;

    await sql`
      create table if not exists asset_finance_books (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        asset_id text not null references fixed_assets (id) on delete cascade,
        finance_book text not null,
        method text not null default 'straight_line',
        useful_life_months integer,
        total_expected_units numeric,
        depreciated_units numeric not null default 0,
        created_at timestamptz not null default now(),
        unique (tenant_slug, asset_id, finance_book)
      )`;

    await sql`
      create table if not exists asset_usage_log (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        asset_id text not null references fixed_assets (id) on delete cascade,
        period_date date not null,
        units numeric not null,
        finance_book text not null default 'main',
        created_at timestamptz not null default now()
      )`;
    await sql`create index if not exists asset_usage_idx on asset_usage_log (tenant_slug, asset_id)`;
  });
}

// ─── Locations & movements ──────────────────────────────────────────────────

export async function recordAssetMovement(input: {
  tenantSlug: string; assetId: string; toLocation: string;
  custodian?: string; notes?: string;
}) {
  await ensureAssetLifecycleTables();
  const sql = SQL;
  const [asset] = (await sql`
    select location, custodian, status from fixed_assets
    where id = ${input.assetId} and tenant_slug = ${input.tenantSlug}
  `) as any[];
  if (!asset) throw new Error("Asset not found");
  if (asset.status === "disposed") throw new Error("Cannot move a disposed asset");

  await sql`
    insert into asset_movements (id, tenant_slug, asset_id, from_location, to_location, custodian, notes)
    values (${randomUUID()}, ${input.tenantSlug}, ${input.assetId},
            ${asset.location}, ${input.toLocation}, ${input.custodian ?? asset.custodian ?? null}, ${input.notes ?? null})`;
  await sql`
    update fixed_assets
    set location = ${input.toLocation}, custodian = ${input.custodian ?? asset.custodian ?? null}
    where id = ${input.assetId} and tenant_slug = ${input.tenantSlug}`;
  return { assetId: input.assetId, from: asset.location, to: input.toLocation };
}

export async function listAssetMovements(tenantSlug: string, assetId: string) {
  await ensureAssetLifecycleTables();
  return (await SQL`
    select * from asset_movements
    where tenant_slug = ${tenantSlug} and asset_id = ${assetId}
    order by moved_at
  `) as any[];
}

// ─── Maintenance (teams, schedules, logs — kind 'repair' covers Asset Repair)

export async function createMaintenanceTeam(input: {
  tenantSlug: string; name: string; members?: string[];
}) {
  await ensureAssetLifecycleTables();
  const [row] = (await SQL`
    insert into asset_maintenance_teams (tenant_slug, name, members)
    values (${input.tenantSlug}, ${input.name.trim()}, ${JSON.stringify(input.members ?? [])})
    on conflict (tenant_slug, name)
    do update set members = excluded.members
    returning *
  `) as any[];
  return row;
}

export async function listMaintenanceTeams(tenantSlug: string) {
  await ensureAssetLifecycleTables();
  return (await SQL`
    select * from asset_maintenance_teams where tenant_slug = ${tenantSlug} order by name
  `) as any[];
}

export async function scheduleMaintenance(input: {
  tenantSlug: string; assetId: string; kind?: "preventive" | "repair" | "inspection";
  teamName?: string; scheduledDate: string; description?: string;
}) {
  await ensureAssetLifecycleTables();
  const [asset] = (await SQL`
    select status from fixed_assets where id = ${input.assetId} and tenant_slug = ${input.tenantSlug}
  `) as any[];
  if (!asset) throw new Error("Asset not found");
  if (asset.status === "disposed") throw new Error("Cannot maintain a disposed asset");
  const id = randomUUID();
  await SQL`
    insert into asset_maintenance (id, tenant_slug, asset_id, kind, team_name, status, scheduled_date, description)
    values (${id}, ${input.tenantSlug}, ${input.assetId}, ${input.kind ?? "preventive"},
            ${input.teamName ?? null}, 'scheduled', ${input.scheduledDate}, ${input.description ?? null})`;
  return { id };
}

export async function listMaintenance(tenantSlug: string, assetId?: string, status?: string) {
  await ensureAssetLifecycleTables();
  return (await SQL`
    select m.*, a.asset_no, a.name asset_name
    from asset_maintenance m
    join fixed_assets a on a.id = m.asset_id and a.tenant_slug = m.tenant_slug
    where m.tenant_slug = ${tenantSlug}
      ${assetId ? SQL`and m.asset_id = ${assetId}` : SQL``}
      ${status ? SQL`and m.status = ${status}` : SQL``}
    order by m.scheduled_date
  `) as any[];
}

/**
 * Completes a maintenance task. With cost > 0 a JE posts
 * Dr repairs & maintenance / Cr bank (or creditAccountCode — e.g. AP).
 */
export async function completeMaintenance(input: {
  tenantSlug: string; maintenanceId: string; completedDate: string;
  cost?: number; notes?: string; creditAccountCode?: string;
  financeBook?: string; userId?: string;
  /** Stock parts consumed on a repair — Dr repairs / Cr inventory per part. */
  parts?: Array<{ item: string; qty: number; cost: number }>;
  /** Linked purchase invoice for outsourced repair — Dr repairs / Cr AP. */
  purchaseInvoiceId?: string; purchaseInvoiceAmount?: number;
}) {
  await ensureAssetLifecycleTables();
  const sql = SQL;
  const [m] = (await sql`
    select m.*, a.asset_no, a.name asset_name from asset_maintenance m
    join fixed_assets a on a.id = m.asset_id and a.tenant_slug = m.tenant_slug
    where m.id = ${input.maintenanceId} and m.tenant_slug = ${input.tenantSlug}
  `) as any[];
  if (!m) throw new Error("Maintenance task not found");
  if (m.status === "completed") throw new Error("Task already completed");

  const laborCost = Number(input.cost ?? 0);
  const parts = input.parts ?? [];
  const partsCost = parts.reduce((s, p) => s + p.qty * p.cost, 0);
  const invoiceAmount = input.purchaseInvoiceId ? Number(input.purchaseInvoiceAmount ?? 0) : 0;
  const totalCost = Math.round((laborCost + partsCost + invoiceAmount) * 100) / 100;

  let jeId: string | null = null;
  if (totalCost > 0) {
    const lines: Parameters<typeof postGLEntry>[0]["lines"] = [
      { accountCode: GL_ACCOUNTS.REPAIRS_MAINTENANCE, debitAmount: totalCost, description: `${m.kind} cost — ${m.asset_no}` },
    ];
    if (laborCost > 0) {
      lines.push({ accountCode: input.creditAccountCode ?? GL_ACCOUNTS.BANK, creditAmount: laborCost, description: "Labor settlement" });
    }
    if (partsCost > 0) {
      lines.push({ accountCode: GL_ACCOUNTS.RAW_MATERIALS, creditAmount: partsCost, description: `Parts consumed (${parts.length} items)` });
    }
    if (invoiceAmount > 0) {
      lines.push({ accountCode: GL_ACCOUNTS.ACCOUNTS_PAYABLE, creditAmount: invoiceAmount, description: `Supplier invoice ${input.purchaseInvoiceId}` });
    }
    const je = await postGLEntry({
      tenantSlug: input.tenantSlug,
      entryDate: input.completedDate,
      journalType: "SYSTEM",
      referenceType: "asset_maintenance",
      referenceId: input.maintenanceId,
      financeBook: input.financeBook,
      description: `${m.kind === "repair" ? "Repair" : "Maintenance"} ${m.asset_no} ${m.asset_name}`,
      createdBy: input.userId,
      lines,
    });
    jeId = je.id;
  }

  await sql`
    update asset_maintenance
    set status = 'completed', completed_date = ${input.completedDate},
        cost = ${totalCost}, journal_entry_id = ${jeId},
        parts = ${JSON.stringify(parts)},
        purchase_invoice_id = ${input.purchaseInvoiceId ?? null},
        description = coalesce(${input.notes ?? null}, description)
    where id = ${input.maintenanceId} and tenant_slug = ${input.tenantSlug}`;
  // Repairs return the asset to service
  await sql`
    update fixed_assets set status = 'active'
    where id = ${m.asset_id} and tenant_slug = ${input.tenantSlug} and status = 'under_maintenance'`;
  return { maintenanceId: input.maintenanceId, journalEntryId: jeId, totalCost, partsCost };
}

// ─── Value adjustment (revaluation up → equity reserve; impairment down → P&L)

export async function adjustAssetValue(input: {
  tenantSlug: string; assetId: string; adjustmentDate: string;
  newNetBookValue: number; reason?: string; financeBook?: string; userId?: string;
}) {
  await ensureAssetLifecycleTables();
  const sql = SQL;
  const [asset] = (await sql`
    select * from fixed_assets where id = ${input.assetId} and tenant_slug = ${input.tenantSlug}
  `) as any[];
  if (!asset) throw new Error("Asset not found");
  if (asset.status === "disposed") throw new Error("Cannot revalue a disposed asset");

  const oldNbv = Number(asset.net_book_value);
  const newNbv = Number(input.newNetBookValue);
  const delta = Math.round((newNbv - oldNbv) * 100) / 100;
  if (delta === 0) throw new Error("New value equals current net book value");

  const je = await postGLEntry({
    tenantSlug: input.tenantSlug,
    entryDate: input.adjustmentDate,
    journalType: "ADJUSTMENT",
    referenceType: "asset_revaluation",
    referenceId: input.assetId,
    financeBook: input.financeBook,
    description: `Revaluation ${asset.asset_no} ${asset.name}: ${oldNbv} → ${newNbv}`,
    createdBy: input.userId,
    lines: delta > 0
      ? [
          { accountCode: asset.asset_account_code, debitAmount: delta, description: "Increase asset carrying value" },
          { accountCode: GL_ACCOUNTS.REVALUATION_RESERVE, creditAmount: delta, description: "Revaluation surplus" },
        ]
      : [
          { accountCode: GL_ACCOUNTS.GAIN_LOSS_DISPOSAL, debitAmount: -delta, description: "Impairment loss" },
          { accountCode: asset.asset_account_code, creditAmount: -delta, description: "Decrease asset carrying value" },
        ],
  });

  const id = randomUUID();
  await sql`
    insert into asset_value_adjustments (id, tenant_slug, asset_id, adjustment_date, old_nbv, new_nbv, delta, reason, journal_entry_id, created_by)
    values (${id}, ${input.tenantSlug}, ${input.assetId}, ${input.adjustmentDate},
            ${oldNbv}, ${newNbv}, ${delta}, ${input.reason ?? null}, ${je.id}, ${input.userId ?? null})`;
  // Carrying value moves; status stays 'active' so depreciation keeps running.
  await sql`
    update fixed_assets
    set net_book_value = ${newNbv},
        cost = cost + ${delta}
    where id = ${input.assetId} and tenant_slug = ${input.tenantSlug}`;
  return { id, journalEntryId: je.id, delta };
}

// ─── Capitalization: cost pool (expense/WIP) → new asset ────────────────────

export async function capitalizeAsset(input: {
  tenantSlug: string; name: string; category?: string;
  capitalizationDate: string; amount: number;
  sourceAccountCode?: string; assetAccountCode?: string;
  usefulLifeMonths: number; salvageValue?: number;
  method?: "straight_line" | "reducing_balance";
  depreciationStartDate?: string;
  financeBook?: string; userId?: string;
}) {
  await ensureAssetLifecycleTables();
  if (!(input.amount > 0)) throw new Error("Capitalization amount must be positive");

  const asset = await createAsset({
    tenantSlug: input.tenantSlug,
    name: input.name,
    category: input.category,
    acquisitionDate: input.capitalizationDate,
    cost: input.amount,
    salvageValue: input.salvageValue,
    usefulLifeMonths: input.usefulLifeMonths,
    method: input.method,
    depreciationStartDate: input.depreciationStartDate,
  });
  if (input.financeBook && input.financeBook !== "main") {
    await SQL`update fixed_assets set finance_book = ${input.financeBook} where id = ${asset.id}`;
  }

  const je = await postGLEntry({
    tenantSlug: input.tenantSlug,
    entryDate: input.capitalizationDate,
    journalType: "SYSTEM",
    referenceType: "asset_capitalization",
    referenceId: asset.id,
    financeBook: input.financeBook,
    description: `Capitalize ${input.name} (${asset.assetNo}) from ${input.sourceAccountCode ?? "WIP"}`,
    createdBy: input.userId,
    lines: [
      { accountCode: input.assetAccountCode ?? "1600", debitAmount: input.amount, description: "Recognize fixed asset" },
      { accountCode: input.sourceAccountCode ?? GL_ACCOUNTS.CAPITAL_WIP, creditAmount: input.amount, description: "Release source cost pool" },
    ],
  });

  await SQL`
    insert into asset_capitalizations (id, tenant_slug, asset_id, capitalization_date, source_account_code, amount, journal_entry_id)
    values (${randomUUID()}, ${input.tenantSlug}, ${asset.id}, ${input.capitalizationDate},
            ${input.sourceAccountCode ?? GL_ACCOUNTS.CAPITAL_WIP}, ${input.amount}, ${je.id})`;
  return { assetId: asset.id, assetNo: asset.assetNo, journalEntryId: je.id };
}

// ─── Reports: Depreciation Ledger + Depreciations & Balances ────────────────

export interface DepreciationLedgerRow {
  assetId: string;
  assetNo: string;
  assetName: string;
  periodDate: string;
  openingNbv: number;
  depreciation: number;
  closingNbv: number;
  status: string;
  journalEntryId: string | null;
  financeBook: string;
}

export async function assetDepreciationLedger(input: {
  tenantSlug: string; assetId?: string; periodStart?: string; periodEnd?: string;
  financeBook?: string;
}): Promise<DepreciationLedgerRow[]> {
  await ensureAssetLifecycleTables();
  const params: any[] = [input.tenantSlug];
  let where = `s.tenant_slug = $1`;
  if (input.assetId) { params.push(input.assetId); where += ` and s.asset_id = $${params.length}`; }
  if (input.periodStart) { params.push(input.periodStart); where += ` and s.period_date >= $${params.length}`; }
  if (input.periodEnd) { params.push(input.periodEnd); where += ` and s.period_date <= $${params.length}`; }
  if (input.financeBook) { params.push(input.financeBook); where += ` and s.finance_book = $${params.length}`; }

  const { rows } = await db.query(
    `select s.asset_id, a.asset_no, a.name asset_name, s.period_date::text as period_date, s.amount,
            s.status, s.journal_entry_id, s.finance_book,
            a.cost, a.salvage_value,
            sum(s2.amount) filter (where s2.period_date < s.period_date and s2.status = 'posted') prior_dep
     from asset_depreciation_schedule s
     join fixed_assets a on a.id = s.asset_id and a.tenant_slug = s.tenant_slug
     left join asset_depreciation_schedule s2
            on s2.asset_id = s.asset_id and s2.tenant_slug = s.tenant_slug
     where ${where}
     group by s.id, a.asset_no, a.name, s.period_date, s.amount, s.status,
              s.journal_entry_id, s.finance_book, a.cost, a.salvage_value, s.asset_id
     order by a.asset_no, s.period_date`,
    params,
  );

  return (rows as any[]).map((r) => {
    const prior = Number(r.prior_dep ?? 0);
    const opening = Number(r.cost) - prior;
    return {
      assetId: r.asset_id,
      assetNo: r.asset_no,
      assetName: r.asset_name,
      periodDate: String(r.period_date).slice(0, 10),
      openingNbv: opening,
      depreciation: r.status === "posted" ? Number(r.amount) : 0,
      closingNbv: opening - (r.status === "posted" ? Number(r.amount) : 0),
      status: r.status,
      journalEntryId: r.journal_entry_id,
      financeBook: r.finance_book,
    };
  });
}

export interface AssetBalanceRow {
  assetId: string;
  assetNo: string;
  assetName: string;
  category: string | null;
  location: string | null;
  cost: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  status: string;
}

export async function assetDepreciationsAndBalances(input: {
  tenantSlug: string; financeBook?: string;
}): Promise<AssetBalanceRow[]> {
  await ensureAssetLifecycleTables();
  const sql = SQL;
  return ((await sql`
    select id, asset_no, name, category, location, cost,
           accumulated_depreciation, net_book_value, status
    from fixed_assets
    where tenant_slug = ${input.tenantSlug}
      ${input.financeBook ? SQL`and finance_book = ${input.financeBook}` : SQL``}
    order by asset_no
  `) as any[]).map((r) => ({
    assetId: r.id,
    assetNo: r.asset_no,
    assetName: r.name,
    category: r.category,
    location: r.location,
    cost: Number(r.cost),
    accumulatedDepreciation: Number(r.accumulated_depreciation),
    netBookValue: Number(r.net_book_value),
    status: r.status,
  }));
}

// ─── Location hierarchy (ERPNext Asset Location is a tree) ──────────────────

export async function upsertAssetLocation(input: {
  tenantSlug: string; name: string; parentName?: string;
}) {
  await ensureAssetLifecycleTables();
  const [row] = (await SQL`
    insert into asset_locations (tenant_slug, name, parent_name)
    values (${input.tenantSlug}, ${input.name.trim()}, ${input.parentName ?? null})
    on conflict (tenant_slug, name) do update set parent_name = excluded.parent_name
    returning *
  `) as any[];
  return row;
}

/** Returns locations nested under their parents (roots first). */
export async function listAssetLocationTree(tenantSlug: string) {
  await ensureAssetLifecycleTables();
  const rows = (await SQL`
    select * from asset_locations where tenant_slug = ${tenantSlug} order by name
  `) as any[];
  const nodes = rows.map((r) => ({ name: r.name, parent: r.parent_name, children: [] as any[] }));
  const byName = new Map(nodes.map((n) => [n.name, n]));
  const roots: any[] = [];
  for (const n of nodes) {
    const parent = n.parent ? byName.get(n.parent) : undefined;
    if (parent) parent.children.push(n); else roots.push(n);
  }
  return roots;
}

// ─── Per-finance-book depreciation params (ERPNext Asset Finance Book) ──────

export async function upsertAssetFinanceBook(input: {
  tenantSlug: string; assetId: string; financeBook: string;
  method?: "straight_line" | "reducing_balance" | "units_of_production";
  usefulLifeMonths?: number; totalExpectedUnits?: number;
}) {
  await ensureAssetLifecycleTables();
  const [row] = (await SQL`
    insert into asset_finance_books (tenant_slug, asset_id, finance_book, method, useful_life_months, total_expected_units)
    values (${input.tenantSlug}, ${input.assetId}, ${input.financeBook},
            ${input.method ?? "straight_line"}, ${input.usefulLifeMonths ?? null}, ${input.totalExpectedUnits ?? null})
    on conflict (tenant_slug, asset_id, finance_book) do update set
      method = excluded.method,
      useful_life_months = excluded.useful_life_months,
      total_expected_units = excluded.total_expected_units
    returning *
  `) as any[];
  return row;
}

export async function listAssetFinanceBooks(tenantSlug: string, assetId: string) {
  await ensureAssetLifecycleTables();
  return (await SQL`
    select * from asset_finance_books
    where tenant_slug = ${tenantSlug} and asset_id = ${assetId}
    order by finance_book
  `) as any[];
}

// ─── Usage / shift-factor depreciation (units-of-production) ───────────────

export async function recordAssetUsage(input: {
  tenantSlug: string; assetId: string; periodDate: string; units: number;
  financeBook?: string;
}) {
  await ensureAssetLifecycleTables();
  if (!(input.units > 0)) throw new Error("Units must be positive");
  await SQL`
    insert into asset_usage_log (tenant_slug, asset_id, period_date, units, finance_book)
    values (${input.tenantSlug}, ${input.assetId}, ${input.periodDate}, ${input.units}, ${input.financeBook ?? "main"})`;
}

/**
 * Posts depreciation for one period based on logged usage:
 *   amount = depreciableBase × units / totalExpectedUnits
 * depreciableBase = cost − salvage − accumulated depreciation (per book).
 */
export async function postUsageDepreciation(input: {
  tenantSlug: string; assetId: string; periodDate: string;
  financeBook?: string; userId?: string;
}) {
  await ensureAssetLifecycleTables();
  const sql = SQL;
  const book = input.financeBook ?? "main";
  const [asset] = (await sql`
    select * from fixed_assets where id = ${input.assetId} and tenant_slug = ${input.tenantSlug}
  `) as any[];
  if (!asset) throw new Error("Asset not found");
  if (asset.status === "disposed") throw new Error("Asset disposed");
  const [fb] = (await sql`
    select * from asset_finance_books
    where tenant_slug = ${input.tenantSlug} and asset_id = ${input.assetId} and finance_book = ${book}
  `) as any[];
  if (!fb?.total_expected_units) throw new Error(`No units-of-production params for book '${book}'`);
  if (fb.method !== "units_of_production") throw new Error(`Book '${book}' is not units_of_production`);

  const [{ units }] = (await db.query(
    `select coalesce(sum(units),0) units from asset_usage_log
     where tenant_slug = $1 and asset_id = $2 and period_date = $3 and finance_book = $4`,
    [input.tenantSlug, input.assetId, input.periodDate, book],
  )).rows as any[];
  if (!(Number(units) > 0)) throw new Error("No usage logged for this period");

  const remainingUnits = Number(fb.total_expected_units) - Number(fb.depreciated_units);
  if (remainingUnits <= 0) throw new Error("Asset fully depreciated by usage");
  const effectiveUnits = Math.min(Number(units), remainingUnits);
  const depreciableBase = Number(asset.cost) - Number(asset.salvage_value ?? 0);
  const amount = Math.round(depreciableBase * (effectiveUnits / Number(fb.total_expected_units)) * 100) / 100;
  if (amount <= 0) return { amount: 0, units: effectiveUnits };

  const je = await postGLEntry({
    tenantSlug: input.tenantSlug,
    entryDate: input.periodDate,
    journalType: "SYSTEM",
    referenceType: "asset_depreciation",
    referenceId: input.assetId,
    financeBook: book,
    description: `Usage depreciation ${asset.asset_no} — ${effectiveUnits} units`,
    createdBy: input.userId,
    lines: [
      { accountCode: GL_ACCOUNTS.DEPRECIATION_EXPENSE, debitAmount: amount, description: `Depreciation ${asset.asset_no}` },
      { accountCode: GL_ACCOUNTS.ACCUMULATED_DEPRECIATION, creditAmount: amount, description: `Accumulated ${asset.asset_no}` },
    ],
  });

  await sql`
    update asset_finance_books set depreciated_units = depreciated_units + ${effectiveUnits}
    where tenant_slug = ${input.tenantSlug} and asset_id = ${input.assetId} and finance_book = ${book}`;
  await sql`
    update fixed_assets
    set accumulated_depreciation = accumulated_depreciation + ${amount},
        net_book_value = net_book_value - ${amount}
    where id = ${input.assetId} and tenant_slug = ${input.tenantSlug}`;
  return { amount, units: effectiveUnits, journalEntryId: je.id };
}

// ─── Activity log — unified asset timeline ──────────────────────────────────

export async function getAssetActivity(tenantSlug: string, assetId: string) {
  await ensureAssetLifecycleTables();
  return (await SQL`
    select 'movement' event, to_location detail, moved_at at from asset_movements
      where tenant_slug = ${tenantSlug} and asset_id = ${assetId}
    union all
    select 'maintenance', kind || ' ' || status || ' ' || coalesce(cost::text,''), coalesce(completed_date::timestamptz, created_at)
      from asset_maintenance where tenant_slug = ${tenantSlug} and asset_id = ${assetId}
    union all
    select 'value_adjustment', old_nbv::text || ' → ' || new_nbv::text, created_at
      from asset_value_adjustments where tenant_slug = ${tenantSlug} and asset_id = ${assetId}
    union all
    select 'depreciation', amount::text || ' (' || status || ')', period_date::timestamptz
      from asset_depreciation_schedule where tenant_slug = ${tenantSlug} and asset_id = ${assetId}
    union all
    select 'usage', units::text || ' units', period_date::timestamptz
      from asset_usage_log where tenant_slug = ${tenantSlug} and asset_id = ${assetId}
    union all
    select 'capitalization', amount::text, capitalization_date::timestamptz
      from asset_capitalizations where tenant_slug = ${tenantSlug} and asset_id = ${assetId}
    order by at desc
  `) as any[];
}
