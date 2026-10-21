import { randomUUID } from "node:crypto";
import { sql as SQL } from "../sql-client";
import { createJournalEntry } from "./accounting";
import { GL_ACCOUNTS } from "./gl";
import { recordTaxTransaction } from "./tax-management";
import { ensureOnce } from "@/lib/ensure-once";

export interface ReturnItemInput {
  description: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}

export interface FinanceReturn {
  id: string;
  direction: "sales" | "purchase";
  sourceDocumentId: string;
  documentNo: string;
  status: string;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  reason: string | null;
  restock: boolean;
  createdAt: string;
}

export function ensureReturnTables(...args: Parameters<typeof ensureReturnTablesRun>) {
  return ensureOnce("finance/returns:ensureReturnTables", () => ensureReturnTablesRun(...args));
}

async function ensureReturnTablesRun(sql = SQL) {
  await sql`
    create table if not exists finance_returns (
      id text primary key,
      tenant_slug text not null,
      direction text not null,
      source_document_id text not null,
      document_no text not null,
      status text not null default 'posted',
      items jsonb not null,
      net_amount numeric not null,
      tax_amount numeric not null default 0,
      total_amount numeric not null,
      reason text,
      restock boolean not null default false,
      journal_entry_id text,
      created_by text,
      created_at timestamptz not null default now()
    )
  `;
  await sql`alter table if exists finance_returns add column if not exists warehouse_id text`;
  await sql`alter table if exists finance_returns add column if not exists metadata jsonb`;
  // Status set grew (posted, pending_approval, cancelled) — relax legacy checks.
  await sql`alter table if exists finance_returns drop constraint if exists finance_returns_status_check`;
}

async function nextDocumentNo(tenantSlug: string, prefix: string): Promise<string> {
  const sql = SQL;
  const rows = (await sql`
    select count(*)::int as n from finance_returns where tenant_slug = ${tenantSlug}
  `) as any[];
  return `${prefix}-${String((rows[0]?.n ?? 0) + 1).padStart(4, "0")}`;
}

async function persistReturn(
  tenantSlug: string,
  r: {
    direction: "sales" | "purchase";
    sourceDocumentId: string;
    documentNo: string;
    items: ReturnItemInput[];
    netAmount: number;
    taxAmount: number;
    totalAmount: number;
    reason?: string;
    restock: boolean;
    journalEntryId?: string | null;
    createdBy?: string;
    status?: string;
    warehouseId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<FinanceReturn> {
  const sql = SQL;
  const id = `ret_${randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();
  await sql`
    insert into finance_returns (
      id, tenant_slug, direction, source_document_id, document_no, status,
      items, net_amount, tax_amount, total_amount, reason, restock,
      journal_entry_id, warehouse_id, metadata, created_by, created_at
    ) values (
      ${id}, ${tenantSlug}, ${r.direction}, ${r.sourceDocumentId}, ${r.documentNo},
      ${r.status ?? "posted"}, ${JSON.stringify(r.items)}, ${r.netAmount}, ${r.taxAmount},
      ${r.totalAmount}, ${r.reason ?? null}, ${r.restock},
      ${r.journalEntryId ?? null}, ${r.warehouseId ?? null},
      ${r.metadata ? JSON.stringify(r.metadata) : null}, ${r.createdBy ?? null}, ${now}
    )
  `;
  return {
    id,
    direction: r.direction,
    sourceDocumentId: r.sourceDocumentId,
    documentNo: r.documentNo,
    status: r.status ?? "posted",
    netAmount: r.netAmount,
    taxAmount: r.taxAmount,
    totalAmount: r.totalAmount,
    reason: r.reason ?? null,
    restock: r.restock,
    createdAt: now,
  };
}

function computeAmounts(items: ReturnItemInput[]) {
  let net = 0;
  let tax = 0;
  for (const it of items) {
    const line = it.quantity * it.unitPrice;
    net += line;
    tax += (line * (it.taxRate ?? 0)) / 100;
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { net: r2(net), tax: r2(tax), total: r2(net + tax) };
}

async function restockItems(
  tenantSlug: string,
  items: ReturnItemInput[],
  sign: 1 | -1,
  opts: { warehouseId?: string; referenceId: string; documentNo: string }
) {
  const { recordStockMovement } = await import("../inventory/stock-movements");
  for (const it of items) {
    if (!it.sku) continue;
    await recordStockMovement(
      tenantSlug,
      {
        productSku: it.sku,
        productName: it.description,
        movementType: sign > 0 ? "return" : "adjustment",
        quantity: sign > 0 ? it.quantity : -Math.abs(it.quantity),
        unitCost: it.unitPrice,
        referenceType: "return",
        referenceId: opts.referenceId,
        warehouseId: opts.warehouseId,
        notes: `${opts.documentNo} — ${sign > 0 ? "restock" : "destock"}`,
      },
      // Sales returns (sign > 0) post the "return" JE — Dr inventory / Cr COGS —
      // so restocking keeps the inventory GL in step. Purchase-return destock
      // stays silent because the debit-note JE already credits inventory.
      { skipJournalEntry: sign < 0 }
    );
  }
}

// ---------------------------------------------------------------------------
// Shared effect application — used by the immediate path and by
// finalizeReturn when a gated return is approved.
// ---------------------------------------------------------------------------

type ReturnEffectsInput = {
  direction: "sales" | "purchase";
  sourceDocumentId: string;
  documentNo: string;
  items: ReturnItemInput[];
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  restock: boolean;
  warehouseId?: string | null;
  metadata?: { creditAccountCode?: string } | null;
  returnId: string;
};

async function applyReturnEffects(tenantSlug: string, ret: ReturnEffectsInput): Promise<string | null> {
  const sql = SQL;
  const today = new Date().toISOString().split("T")[0];

  if (ret.direction === "sales") {
    const inv = (await sql`
      select invoice_number from finance_invoices
      where id = ${ret.sourceDocumentId} and tenant_slug = ${tenantSlug}
    `) as any[];

    const je = await createJournalEntry({
      tenantSlug,
      entryDate: today,
      referenceType: "sales_return",
      referenceId: ret.sourceDocumentId,
      description: `Credit note ${ret.documentNo} — return against ${inv[0]?.invoice_number ?? ret.sourceDocumentId}`,
      lines: [
        { accountCode: GL_ACCOUNTS.SALES_RETURNS, debitAmount: ret.netAmount, creditAmount: 0, description: "Sales return" },
        ...(ret.taxAmount > 0
          ? [{ accountCode: GL_ACCOUNTS.VAT_OUTPUT, debitAmount: ret.taxAmount, creditAmount: 0, description: "Output VAT reversal" }]
          : []),
        { accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE, debitAmount: 0, creditAmount: ret.totalAmount, description: "Reduce receivable" },
      ],
    });

    await sql`
      update finance_invoices
      set balance_due = greatest(0, balance_due - ${ret.totalAmount})
      where id = ${ret.sourceDocumentId} and tenant_slug = ${tenantSlug}
    `;

    if (ret.taxAmount > 0) {
      await recordTaxTransaction({
        tenantSlug,
        transactionType: "vat_output",
        sourceType: "invoice",
        sourceId: ret.sourceDocumentId,
        transactionDate: today,
        description: `VAT reversal — credit note ${ret.documentNo}`,
        baseAmount: -ret.netAmount,
        taxRate: ret.items[0]?.taxRate ?? 0,
        taxAmount: -ret.taxAmount,
      });
    }

    if (ret.restock) {
      await restockItems(tenantSlug, ret.items, 1, {
        warehouseId: ret.warehouseId ?? undefined,
        referenceId: ret.returnId,
        documentNo: ret.documentNo,
      });
    }
    return (je as any)?.id ?? null;
  }

  // Purchase return
  const bill = (await sql`
    select bill_number from bills
    where id = ${ret.sourceDocumentId} and tenant_slug = ${tenantSlug}
  `) as any[];
  const creditAccount = ret.metadata?.creditAccountCode
    ?? (ret.restock ? GL_ACCOUNTS.RAW_MATERIALS : GL_ACCOUNTS.GENERAL_EXPENSE);

  const je = await createJournalEntry({
    tenantSlug,
    entryDate: today,
    referenceType: "purchase_return",
    referenceId: ret.sourceDocumentId,
    description: `Debit note ${ret.documentNo} — return against ${bill[0]?.bill_number ?? ret.sourceDocumentId}`,
    lines: [
      { accountCode: GL_ACCOUNTS.ACCOUNTS_PAYABLE, debitAmount: ret.totalAmount, creditAmount: 0, description: "Reduce payable" },
      { accountCode: creditAccount, debitAmount: 0, creditAmount: ret.netAmount, description: "Purchase return" },
      ...(ret.taxAmount > 0
        ? [{ accountCode: GL_ACCOUNTS.VAT_INPUT, debitAmount: 0, creditAmount: ret.taxAmount, description: "Input VAT reversal" }]
        : []),
    ],
  });

  await sql`
    update bills
    set balance_due = greatest(0, balance_due - ${ret.totalAmount})
    where id = ${ret.sourceDocumentId} and tenant_slug = ${tenantSlug}
  `;

  if (ret.taxAmount > 0) {
    await recordTaxTransaction({
      tenantSlug,
      transactionType: "vat_input",
      sourceType: "bill",
      sourceId: ret.sourceDocumentId,
      transactionDate: today,
      description: `Input VAT reversal — debit note ${ret.documentNo}`,
      baseAmount: -ret.netAmount,
      taxRate: ret.items[0]?.taxRate ?? 0,
      taxAmount: -ret.taxAmount,
    });
  }

  if (ret.restock) {
    await restockItems(tenantSlug, ret.items, -1, {
      warehouseId: ret.warehouseId ?? undefined,
      referenceId: ret.returnId,
      documentNo: ret.documentNo,
    });
  }

  try {
    const { emitEvent } = await import("@/lib/notify");
    void emitEvent({
      tenantSlug,
      eventType: "return.posted",
      sourceModule: "finance",
      sourceRecordId: ret.returnId,
      dedupeKey: `return:${ret.returnId}`,
      payload: {
        direction: ret.direction,
        documentNo: ret.documentNo,
        sourceDocumentId: ret.sourceDocumentId,
        totalAmount: ret.totalAmount,
        restock: ret.restock,
        reason: (ret.metadata as any)?.reason,
      },
    });
  } catch (err) {
    console.error("Failed to emit return.posted:", err);
  }

  return (je as any)?.id ?? null;
}

/**
 * Completes a return that was held pending approval — posts the JE, applies
 * the invoice/bill balance reduction, VAT reversal, and stock movement, then
 * marks the return posted. No-op-safe to call only on 'pending_approval' rows.
 */
export async function finalizeReturn(tenantSlug: string, returnId: string): Promise<void> {
  const sql = SQL;
  await ensureReturnTables(sql);
  const rows = (await sql`
    select * from finance_returns where id = ${returnId} and tenant_slug = ${tenantSlug}
  `) as any[];
  if (!rows[0]) throw new Error(`Return ${returnId} not found`);
  if (rows[0].status !== "pending_approval") throw new Error(`Return ${returnId} is ${rows[0].status}`);

  const r = rows[0];
  const jeId = await applyReturnEffects(tenantSlug, {
    direction: r.direction,
    sourceDocumentId: r.source_document_id,
    documentNo: r.document_no,
    items: typeof r.items === "string" ? JSON.parse(r.items) : r.items,
    netAmount: Number(r.net_amount),
    taxAmount: Number(r.tax_amount),
    totalAmount: Number(r.total_amount),
    restock: r.restock === true,
    warehouseId: r.warehouse_id,
    metadata: typeof r.metadata === "string" ? JSON.parse(r.metadata ?? "{}") : r.metadata,
    returnId: r.id,
  });

  await sql`
    update finance_returns set status = 'posted', journal_entry_id = ${jeId}
    where id = ${returnId} and tenant_slug = ${tenantSlug}
  `;
}

// ---------------------------------------------------------------------------
// Sales return (credit note)
// ---------------------------------------------------------------------------

export async function createSalesReturn(
  tenantSlug: string,
  input: {
    invoiceId: string;
    items: ReturnItemInput[];
    reason?: string;
    restock?: boolean;
    warehouseId?: string;
    createdBy?: string;
  },
  opts?: { skipApproval?: boolean }
): Promise<FinanceReturn> {
  const sql = SQL;
  await ensureReturnTables(sql);
  if (!input.items?.length) throw new Error("Return requires at least one item");

  const inv = (await sql`
    select id, invoice_number, status, balance_due from finance_invoices
    where id = ${input.invoiceId} and tenant_slug = ${tenantSlug}
  `) as any[];
  if (!inv[0]) throw new Error(`Invoice ${input.invoiceId} not found`);
  if (inv[0].status === "void") throw new Error("Cannot return a void invoice");

  const { net, tax, total } = computeAmounts(input.items);
  const documentNo = await nextDocumentNo(tenantSlug, "CN");

  // Maker-checker: persist the return pending approval and defer every
  // financial effect (JE, invoice balance, VAT tx, restock) until approval.
  const gated = !opts?.skipApproval
    && await (await import("./approvals")).requiresApproval(tenantSlug, "sales_return", { amount: total });

  const ret = await persistReturn(tenantSlug, {
    direction: "sales",
    sourceDocumentId: input.invoiceId,
    documentNo,
    items: input.items,
    netAmount: net,
    taxAmount: tax,
    totalAmount: total,
    reason: input.reason,
    restock: input.restock === true,
    status: gated ? "pending_approval" : "posted",
    warehouseId: input.warehouseId,
    createdBy: input.createdBy,
  });

  if (gated) {
    await (await import("./approvals")).initiateApproval({
      tenantSlug,
      entityType: "sales_return",
      entityId: ret.id,
      requestedBy: input.createdBy ?? "system",
      entityData: { amount: total, invoiceId: input.invoiceId, documentNo },
    });
    return ret;
  }

  const jeId = await applyReturnEffects(tenantSlug, {
    direction: "sales",
    sourceDocumentId: input.invoiceId,
    documentNo,
    items: input.items,
    netAmount: net,
    taxAmount: tax,
    totalAmount: total,
    restock: input.restock === true,
    warehouseId: input.warehouseId,
    returnId: ret.id,
  });

  await sql`update finance_returns set journal_entry_id = ${jeId} where id = ${ret.id}`;
  return ret;
}

// ---------------------------------------------------------------------------
// Purchase return (debit note)
// ---------------------------------------------------------------------------

export async function createPurchaseReturn(
  tenantSlug: string,
  input: {
    billId: string;
    items: ReturnItemInput[];
    reason?: string;
    destock?: boolean;
    warehouseId?: string;
    creditAccountCode?: string;
    createdBy?: string;
  },
  opts?: { skipApproval?: boolean }
): Promise<FinanceReturn> {
  const sql = SQL;
  await ensureReturnTables(sql);
  if (!input.items?.length) throw new Error("Return requires at least one item");

  const bill = (await sql`
    select id, bill_number, status, balance_due from bills
    where id = ${input.billId} and tenant_slug = ${tenantSlug}
  `) as any[];
  if (!bill[0]) throw new Error(`Bill ${input.billId} not found`);
  if (bill[0].status === "cancelled") throw new Error("Cannot return a cancelled bill");

  const { net, tax, total } = computeAmounts(input.items);
  const documentNo = await nextDocumentNo(tenantSlug, "DN");

  const gated = !opts?.skipApproval
    && await (await import("./approvals")).requiresApproval(tenantSlug, "purchase_return", { amount: total });

  const ret = await persistReturn(tenantSlug, {
    direction: "purchase",
    sourceDocumentId: input.billId,
    documentNo,
    items: input.items,
    netAmount: net,
    taxAmount: tax,
    totalAmount: total,
    reason: input.reason,
    restock: input.destock === true,
    status: gated ? "pending_approval" : "posted",
    warehouseId: input.warehouseId,
    metadata: input.creditAccountCode ? { creditAccountCode: input.creditAccountCode } : undefined,
    createdBy: input.createdBy,
  });

  if (gated) {
    await (await import("./approvals")).initiateApproval({
      tenantSlug,
      entityType: "purchase_return",
      entityId: ret.id,
      requestedBy: input.createdBy ?? "system",
      entityData: { amount: total, billId: input.billId, documentNo },
    });
    return ret;
  }

  const jeId = await applyReturnEffects(tenantSlug, {
    direction: "purchase",
    sourceDocumentId: input.billId,
    documentNo,
    items: input.items,
    netAmount: net,
    taxAmount: tax,
    totalAmount: total,
    restock: input.destock === true,
    warehouseId: input.warehouseId,
    metadata: input.creditAccountCode ? { creditAccountCode: input.creditAccountCode } : null,
    returnId: ret.id,
  });

  await sql`update finance_returns set journal_entry_id = ${jeId} where id = ${ret.id}`;
  return ret;
}

export async function listReturns(
  tenantSlug: string,
  opts: { direction?: "sales" | "purchase"; sourceDocumentId?: string; limit?: number } = {}
): Promise<FinanceReturn[]> {
  const sql = SQL;
  await ensureReturnTables(sql);
  const limit = Math.min(opts.limit ?? 100, 500);
  const rows = (await sql`
    select * from finance_returns
    where tenant_slug = ${tenantSlug}
      and (${opts.direction ?? null}::text is null or direction = ${opts.direction ?? null})
      and (${opts.sourceDocumentId ?? null}::text is null or source_document_id = ${opts.sourceDocumentId ?? null})
    order by created_at desc limit ${limit}
  `) as any[];
  return rows.map((r) => ({
    id: r.id,
    direction: r.direction,
    sourceDocumentId: r.source_document_id,
    documentNo: r.document_no,
    status: r.status,
    netAmount: Number(r.net_amount),
    taxAmount: Number(r.tax_amount),
    totalAmount: Number(r.total_amount),
    reason: r.reason,
    restock: r.restock,
    createdAt: r.created_at,
  }));
}
