import { randomUUID } from "node:crypto";
import { sql as SQL } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { createSalesReturn } from "../finance/returns";
import { createPayment } from "../finance/db";
import { postGLEntry, GL_ACCOUNTS } from "../finance/gl";
import { recordStockMovement } from "../inventory/stock-movements";
import { getPosSale, ensurePosTables } from "./sales";
import { logPosAudit } from "./config";

export function ensureReturnTables(...args: Parameters<typeof ensureRun>) {
  return ensureOnce("pos/returns:ensure", () => ensureRun(...args));
}

async function ensureRun(sql = SQL) {
  await sql`
    create table if not exists pos_returns (
      id text primary key,
      tenant_slug text not null,
      sale_id text not null,
      invoice_id text,
      credit_note_id text,
      items jsonb not null,
      refund_method text not null default 'cash',
      refund_amount numeric not null,
      restocked boolean not null default false,
      reason text,
      created_by text,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists pos_returns_sale on pos_returns (tenant_slug, sale_id)`;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const REFUND_ACCOUNT: Record<string, string> = {
  cash: GL_ACCOUNTS.CASH,
  pos: GL_ACCOUNTS.BANK,
  bank_transfer: GL_ACCOUNTS.BANK,
  mobile_money: GL_ACCOUNTS.BANK,
};

/**
 * Return items from a completed POS sale:
 *  - finance credit note (Dr sales returns + VAT reversal / Cr AR)
 *  - restock with the COGS-reversal JE (serials go back in_stock)
 *  - refund JE + payment row against the tender's account
 *  - returned quantities tracked per sale so nothing can be returned twice
 */
export async function createPosReturn(
  tenantSlug: string,
  input: {
    saleId?: string;
    receiptNo?: string;
    items: Array<{ sku: string; quantity: number; serialNos?: string[]; lotNo?: string }>;
    refundMethod?: "cash" | "pos" | "bank_transfer" | "mobile_money";
    restock?: boolean;
    reason?: string;
    createdBy?: string;
  }
): Promise<{ id: string; creditNoteId: string; refundAmount: number } | { error: string }> {
  const sql = SQL;
  await ensurePosTables(sql);
  await ensureReturnTables(sql);
  if (!input.items?.length) return { error: "Return requires at least one item" };

  const sale = await getPosSale(tenantSlug, { id: input.saleId, receiptNo: input.receiptNo });
  if (!sale) return { error: "Sale not found" };
  if (sale.status !== "completed" && sale.status !== "partially_refunded") {
    return { error: `Cannot return a sale with status "${sale.status}"` };
  }
  if (!sale.invoiceId) return { error: "Sale has no linked invoice" };

  // Already-returned quantities per SKU.
  const prior = (await sql`
    select items from pos_returns where tenant_slug = ${tenantSlug} and sale_id = ${sale.id}
  `) as any[];
  const returnedSoFar = new Map<string, number>();
  for (const p of prior) {
    const its = typeof p.items === "string" ? JSON.parse(p.items) : p.items;
    for (const it of its ?? []) {
      returnedSoFar.set(it.sku, (returnedSoFar.get(it.sku) ?? 0) + Number(it.quantity));
    }
  }

  const soldBySku = new Map<string, any>((sale.items ?? []).map((l: any) => [l.sku as string, l]));
  const returnItems: Array<{
    sku: string; description: string; quantity: number; unitPrice: number; taxRate: number;
    serialNos?: string[]; lotNo?: string; allocatedNet: number;
  }> = [];
  for (const it of input.items) {
    const sold = soldBySku.get(it.sku) as any;
    if (!sold) return { error: `SKU "${it.sku}" was not on this sale` };
    const qty = Number(it.quantity);
    if (!(qty > 0)) return { error: `Invalid quantity for "${it.sku}"` };
    const remaining = Number(sold.qty) - (returnedSoFar.get(it.sku) ?? 0);
    if (qty > remaining) {
      return { error: `Cannot return ${qty} × ${it.sku} — only ${remaining} unreturned` };
    }
    // Unit refund = the allocated post-discount net per unit, tax at the line's rate.
    const allocatedNet = Number(sold.allocatedNet ?? sold.taxableAmount ?? sold.amount);
    returnItems.push({
      sku: it.sku,
      description: sold.name,
      quantity: qty,
      unitPrice: r2(allocatedNet / sold.qty),
      taxRate: Number(sold.taxRate ?? 0),
      serialNos: it.serialNos,
      lotNo: it.lotNo,
      allocatedNet,
    });
  }

  const refundMethod = input.refundMethod ?? "cash";
  const creditNote = await createSalesReturn(tenantSlug, {
    invoiceId: sale.invoiceId,
    items: returnItems.map((r) => ({
      sku: r.sku, description: r.description, quantity: r.quantity,
      unitPrice: r.unitPrice, taxRate: r.taxRate,
    })),
    reason: input.reason,
    restock: false,
    createdBy: input.createdBy,
  }, { skipApproval: true });
  const refundAmount = Number((creditNote as any).totalAmount ?? 0);

  // Restock through the stock engine — the "return" movement posts the
  // COGS-reversal JE (Dr 1500 / Cr 5000) and restores serials/lots.
  if (input.restock !== false) {
    for (const r of returnItems) {
      const prod = (await sql`
        select unit_cost from inventory_products where tenant_slug = ${tenantSlug} and sku = ${r.sku}
      `) as any[];
      await recordStockMovement(tenantSlug, {
        productSku: r.sku,
        productName: r.description,
        movementType: "return",
        quantity: r.quantity,
        unitCost: Number(prod[0]?.unit_cost ?? 0),
        referenceType: "pos_return",
        referenceId: (creditNote as any).id,
        warehouseId: sale.warehouseId ?? undefined,
        serialNos: r.serialNos,
        lotNo: r.lotNo,
        notes: `POS return ${sale.receiptNo} — ${(creditNote as any).documentNo ?? ""}`,
      });
    }
  }

  // Refund: cash/leaves-till JE (Dr AR restores receivable cleared by the CN,
  // Cr the refund account) + a reversed payment row for the ledger trail.
  const today = new Date().toISOString().split("T")[0];
  await postGLEntry({
    tenantSlug,
    entryDate: today,
    journalType: "SYSTEM",
    referenceType: "pos_return",
    referenceId: (creditNote as any).id,
    description: `POS refund ${sale.receiptNo} — ${refundMethod}`,
    status: "POSTED",
    lines: [
      { accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE, debitAmount: refundAmount, creditAmount: 0, description: "Refund receivable" },
      { accountCode: REFUND_ACCOUNT[refundMethod] ?? GL_ACCOUNTS.CASH, debitAmount: 0, creditAmount: refundAmount, description: `Refund via ${refundMethod}` },
    ],
  });
  await createPayment({
    tenantSlug,
    invoiceId: sale.invoiceId,
    reference: `${sale.receiptNo}-REF`,
    grossAmount: -refundAmount,
    fees: 0,
    method: refundMethod,
    paymentDate: today,
    confirmationDetails: `POS refund for ${sale.receiptNo}`,
    status: "reversed",
    linkedInvoices: [sale.invoiceId],
    metadata: { posReturn: (creditNote as any).id },
  });

  const id = `pret_${randomUUID().slice(0, 10)}`;
  await sql`
    insert into pos_returns (id, tenant_slug, sale_id, invoice_id, credit_note_id, items, refund_method, refund_amount, restocked, reason, created_by)
    values (${id}, ${tenantSlug}, ${sale.id}, ${sale.invoiceId}, ${(creditNote as any).id},
            ${JSON.stringify(input.items)}, ${refundMethod}, ${refundAmount},
            ${input.restock !== false}, ${input.reason ?? null}, ${input.createdBy ?? null})
  `;

  // Fully returned => refunded; otherwise partially_refunded.
  const fully = [...soldBySku.keys()].every((sku) => {
    const sold = Number((soldBySku.get(sku) as any).qty);
    const ret = (returnedSoFar.get(sku) ?? 0) + (input.items.find((i) => i.sku === sku)?.quantity ?? 0);
    return ret >= sold;
  });
  await sql`
    update pos_sales set status = ${fully ? "refunded" : "partially_refunded"}
    where id = ${sale.id} and tenant_slug = ${tenantSlug}
  `;

  // Loyalty clawback: reverse earned points pro-rata to the refund.
  if (sale.customerCode) {
    const earned = (await sql`
      select coalesce(sum(points),0)::numeric as pts from pos_loyalty_txns
      where tenant_slug = ${tenantSlug} and sale_id = ${sale.id} and type = 'earn'
    `) as any[];
    const clawback = Math.floor(Number(earned[0]?.pts ?? 0) * (refundAmount / Math.max(1, Number(sale.totalAmount))));
    if (clawback > 0) {
      await sql`
        insert into pos_loyalty_txns (id, tenant_slug, customer_code, sale_id, type, points, value, note)
        values (${`plt_${randomUUID().slice(0, 10)}`}, ${tenantSlug}, ${sale.customerCode}, ${sale.id},
                'redeem', ${clawback}, null, ${`Clawback — refund ${sale.receiptNo}`})
      `;
    }
  }

  await logPosAudit(tenantSlug, {
    action: "pos_return", actor: input.createdBy, entityType: "pos_sale", entityId: sale.id,
    detail: { creditNoteId: (creditNote as any).id, refundAmount, refundMethod, items: input.items },
  });

  return { id, creditNoteId: (creditNote as any).id, refundAmount };
}

export async function listPosReturns(tenantSlug: string, opts: { saleId?: string; limit?: number } = {}) {
  const sql = SQL;
  await ensureReturnTables(sql);
  return (await sql`
    select * from pos_returns
    where tenant_slug = ${tenantSlug}
      and (${opts.saleId ?? null}::text is null or sale_id = ${opts.saleId ?? null})
    order by created_at desc limit ${Math.min(opts.limit ?? 100, 500)}
  `) as any[];
}
