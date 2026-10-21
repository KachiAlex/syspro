import { randomUUID } from "node:crypto";
import { sql as SQL } from "../sql-client";
import { createJournalEntry } from "../finance/accounting";
import { GL_ACCOUNTS } from "../finance/gl";
import { ensureOnce } from "@/lib/ensure-once";

export type ChargeType = "freight" | "customs_duty" | "insurance" | "other";
export type AllocationMethod = "value" | "quantity" | "manual";

export interface LandedCostItem {
  sku: string;
  quantity: number;
  unitCost: number;
  allocatedAmount?: number; // required when method = 'manual'
}

export interface LandedCostVoucher {
  id: string;
  referenceId: string;
  chargeType: ChargeType;
  totalAmount: number;
  allocationMethod: AllocationMethod;
  allocations: Array<{ sku: string; amount: number }>;
  journalEntryId: string | null;
  status: string;
  createdAt: string;
}

export function ensureLandedCostTables(...args: Parameters<typeof ensureLandedCostTablesRun>) {
  return ensureOnce("inventory/landed-cost:ensureLandedCostTables", () => ensureLandedCostTablesRun(...args));
}

async function ensureLandedCostTablesRun(sql = SQL) {
  await sql`
    create table if not exists landed_cost_vouchers (
      id text primary key,
      tenant_slug text not null,
      reference_id text not null,
      charge_type text not null,
      total_amount numeric not null,
      allocation_method text not null default 'value',
      allocations jsonb,
      expense_account_code text,
      journal_entry_id text,
      status text not null default 'posted',
      created_at timestamptz not null default now()
    )
  `;
}

const CHARGE_LABELS: Record<ChargeType, string> = {
  freight: "Freight & shipping",
  customs_duty: "Customs duty",
  insurance: "Insurance",
  other: "Other landed cost",
};

/**
 * Allocate an additional landed charge (freight, duty, insurance) across the
 * items it applies to, fold it into each product's moving-average unit cost,
 * and post the capitalization journal: Dr Inventory / Cr payable account.
 */
export async function createLandedCostVoucher(
  tenantSlug: string,
  input: {
    referenceId: string;
    chargeType: ChargeType;
    totalAmount: number;
    allocationMethod?: AllocationMethod;
    items: LandedCostItem[];
    payableAccountCode?: string; // default: Accounts Payable
    createdBy?: string;
  }
): Promise<LandedCostVoucher> {
  const sql = SQL;
  await ensureLandedCostTables(sql);
  if (!input.items?.length) throw new Error("Landed cost requires at least one item");
  if (!(input.totalAmount > 0)) throw new Error("totalAmount must be positive");
  const method = input.allocationMethod ?? "value";

  // ---- allocate ----------------------------------------------------------
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const allocations: Array<{ sku: string; amount: number }> = [];
  if (method === "manual") {
    const sum = input.items.reduce((s, i) => s + Number(i.allocatedAmount ?? 0), 0);
    if (Math.abs(sum - input.totalAmount) > 0.01) {
      throw new Error(`Manual allocations (${r2(sum)}) must sum to the total (${input.totalAmount})`);
    }
    for (const i of input.items) allocations.push({ sku: i.sku, amount: r2(Number(i.allocatedAmount)) });
  } else {
    const basis = input.items.map((i) =>
      method === "quantity" ? i.quantity : i.quantity * i.unitCost
    );
    const totalBasis = basis.reduce((s, b) => s + b, 0);
    if (totalBasis <= 0) throw new Error("Cannot allocate: items have no value or quantity");
    let allocated = 0;
    input.items.forEach((item, idx) => {
      const isLast = idx === input.items.length - 1;
      // Last item takes the remainder so rounding never leaves a residue.
      const amount = isLast
        ? r2(input.totalAmount - allocated)
        : r2((input.totalAmount * basis[idx]) / totalBasis);
      allocated += amount;
      allocations.push({ sku: item.sku, amount });
    });
  }

  // ---- fold into unit costs (moving average over on-hand stock) ----------
  for (const alloc of allocations) {
    if (alloc.amount <= 0) continue;
    await sql`
      update inventory_products
      set unit_cost = case
        when current_stock > 0 then unit_cost + ${alloc.amount} / current_stock
        else unit_cost
      end
      where tenant_slug = ${tenantSlug} and sku = ${alloc.sku}
    `;
  }

  // ---- journal: Dr Inventory / Cr payable --------------------------------
  const today = new Date().toISOString().split("T")[0];
  const payable = input.payableAccountCode ?? GL_ACCOUNTS.ACCOUNTS_PAYABLE;
  const je = await createJournalEntry({
    tenantSlug,
    entryDate: today,
    referenceType: "landed_cost",
    referenceId: input.referenceId,
    description: `Landed cost — ${CHARGE_LABELS[input.chargeType] ?? input.chargeType} on ${input.referenceId}`,
    lines: [
      { accountCode: GL_ACCOUNTS.RAW_MATERIALS, debitAmount: input.totalAmount, creditAmount: 0, description: "Capitalize landed cost" },
      { accountCode: payable, debitAmount: 0, creditAmount: input.totalAmount, description: "Landed cost payable" },
    ],
  });

  const id = `lcv_${randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();
  await sql`
    insert into landed_cost_vouchers (
      id, tenant_slug, reference_id, charge_type, total_amount, allocation_method,
      allocations, expense_account_code, journal_entry_id, status, created_at
    ) values (
      ${id}, ${tenantSlug}, ${input.referenceId}, ${input.chargeType},
      ${input.totalAmount}, ${method}, ${JSON.stringify(allocations)},
      ${payable}, ${(je as any)?.id ?? null}, 'posted', ${now}
    )
  `;
  return {
    id,
    referenceId: input.referenceId,
    chargeType: input.chargeType,
    totalAmount: input.totalAmount,
    allocationMethod: method,
    allocations,
    journalEntryId: (je as any)?.id ?? null,
    status: "posted",
    createdAt: now,
  };
}

export async function listLandedCostVouchers(
  tenantSlug: string,
  opts: { referenceId?: string; limit?: number } = {}
): Promise<LandedCostVoucher[]> {
  const sql = SQL;
  await ensureLandedCostTables(sql);
  const limit = Math.min(opts.limit ?? 100, 500);
  const rows = (await sql`
    select * from landed_cost_vouchers
    where tenant_slug = ${tenantSlug}
      and (${opts.referenceId ?? null}::text is null or reference_id = ${opts.referenceId ?? null})
    order by created_at desc limit ${limit}
  `) as any[];
  return rows.map((r) => ({
    id: r.id,
    referenceId: r.reference_id,
    chargeType: r.charge_type,
    totalAmount: Number(r.total_amount),
    allocationMethod: r.allocation_method,
    allocations: typeof r.allocations === "string" ? JSON.parse(r.allocations) : r.allocations,
    journalEntryId: r.journal_entry_id,
    status: r.status,
    createdAt: r.created_at,
  }));
}
