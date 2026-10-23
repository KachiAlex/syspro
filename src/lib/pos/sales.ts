import { randomUUID } from "node:crypto";
import { sql as SQL, db } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { getPool } from "../db";
import { insertFinanceInvoice, createPayment } from "../finance/db";
import { postGLEntry, reverseGLEntry, GL_ACCOUNTS } from "../finance/gl";
import { recordStockMovement } from "../inventory/stock-movements";
import { getOpenShift } from "./shifts";
import { getPosConfig, logPosAudit } from "./config";
import { getRegister } from "./registers";

export function ensurePosTables(...args: Parameters<typeof ensurePosTablesRun>) {
  return ensureOnce("pos/sales:ensurePosTables", () => ensurePosTablesRun(...args));
}

async function ensurePosTablesRun(sql = SQL) {
  await sql`
    create table if not exists pos_sales (
      id text primary key,
      tenant_slug text not null,
      invoice_id text,
      warehouse_id text,
      shift_id text,
      register_id text,
      receipt_no text,
      receipt_seq bigint,
      status text not null default 'completed',
      payment_method text not null default 'cash',
      tenders jsonb,
      amount_tendered numeric,
      change_due numeric,
      discount_amount numeric not null default 0,
      discount_reason text,
      rounding_amount numeric not null default 0,
      card_fees numeric not null default 0,
      customer_name text,
      customer_code text,
      idempotency_key text,
      items jsonb not null,
      net_amount numeric not null,
      tax_amount numeric not null default 0,
      total_amount numeric not null,
      error text,
      created_by text,
      created_at timestamptz not null default now()
    )
  `;
  await sql`alter table if exists pos_sales add column if not exists receipt_no text`;
  await sql`alter table if exists pos_sales add column if not exists receipt_seq bigint`;
  await sql`alter table if exists pos_sales add column if not exists register_id text`;
  await sql`alter table if exists pos_sales add column if not exists status text not null default 'completed'`;
  await sql`alter table if exists pos_sales add column if not exists tenders jsonb`;
  await sql`alter table if exists pos_sales add column if not exists amount_tendered numeric`;
  await sql`alter table if exists pos_sales add column if not exists change_due numeric`;
  await sql`alter table if exists pos_sales add column if not exists discount_amount numeric not null default 0`;
  await sql`alter table if exists pos_sales add column if not exists discount_reason text`;
  await sql`alter table if exists pos_sales add column if not exists rounding_amount numeric not null default 0`;
  await sql`alter table if exists pos_sales add column if not exists card_fees numeric not null default 0`;
  await sql`alter table if exists pos_sales add column if not exists customer_code text`;
  await sql`alter table if exists pos_sales add column if not exists idempotency_key text`;
  await sql`alter table if exists pos_sales add column if not exists error text`;
  await sql`alter table if exists pos_sales add column if not exists promotions text[]`;
  await sql`alter table if exists pos_sales add column if not exists ereceipt_sent_at timestamptz`;
  await sql`alter table if exists pos_sales add column if not exists ereceipt_to text`;
  await sql`create unique index if not exists pos_sales_idem on pos_sales (tenant_slug, idempotency_key) where idempotency_key is not null`;
  await sql`alter table if exists pos_sales add column if not exists branch_id text`;
  await sql`alter table if exists pos_sales add column if not exists local_invoice_no text`;
  await sql`create unique index if not exists pos_sales_local_inv on pos_sales (tenant_slug, local_invoice_no) where local_invoice_no is not null`;
  await sql`create index if not exists pos_sales_branch on pos_sales (tenant_slug, branch_id) where branch_id is not null`;
  await sql`create index if not exists pos_sales_receipt on pos_sales (tenant_slug, receipt_no)`;
  await sql`
    create table if not exists pos_counters (
      tenant_slug text not null,
      counter_key text not null,
      next_seq bigint not null default 1,
      primary key (tenant_slug, counter_key)
    )
  `;
  // Child tables the sale saga touches.
  const { ensureShiftTables } = await import("./shifts");
  const { ensureLoyaltyTables } = await import("./loyalty");
  const { ensurePriceListTables } = await import("./price-lists");
  const { ensureRegisterTables } = await import("./registers");
  const { ensurePromotionTables } = await import("./promotions");
  await ensureShiftTables(sql);
  await ensureLoyaltyTables(sql);
  await ensurePriceListTables(sql);
  await ensureRegisterTables(sql);
  await ensurePromotionTables(sql);
}

export interface PosItem {
  sku: string;
  quantity: number;
  unitPrice?: number;            // override — audited against list price
  discountPct?: number;
  discountAmount?: number;
  taxExempt?: boolean;
  serialNos?: string[];
  lotNo?: string;
}

export interface PosTender {
  method: "cash" | "pos" | "bank_transfer" | "mobile_money" | "store_credit";
  amount?: number;                // base-currency amount applied to the bill
  amountForeign?: number;         // foreign-currency tender — converts via exchange rate
  currency?: string;              // foreign currency code (e.g. "USD")
  exchangeRate?: number;          // foreign units per base unit; falls back to rate table
  tendered?: number;              // handed over (cash only — drives change)
  accountCode?: string;           // GL account override for this tender
  reference?: string;
}

interface ResolvedLine {
  sku: string; name: string; qty: number; price: number; amount: number;
  discount: number; taxableAmount: number; taxRate: number; taxAmount: number;
  cost: number; productId: string; tracking: string;
  serialNos?: string[]; lotNo?: string; priceOverridden: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const TENDER_ACCOUNT: Record<string, string> = {
  cash: GL_ACCOUNTS.CASH,
  pos: GL_ACCOUNTS.BANK,
  bank_transfer: GL_ACCOUNTS.BANK,
  mobile_money: GL_ACCOUNTS.BANK,
  store_credit: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE,
};

async function getTenantCurrency(tenantSlug: string): Promise<string> {
  try {
    const rows = (await SQL`
      select coalesce(settings->>'baseCurrency', settings->>'currency') as c
      from tenants where slug = ${tenantSlug}
    `) as any[];
    return rows[0]?.c || "NGN";
  } catch {
    return "NGN";
  }
}

/** Atomic per-register sequential receipt number. */
async function nextReceiptSeq(tenantSlug: string, counterKey: string): Promise<number> {
  const res = await db.query<{ next_seq: number }>(
    `insert into pos_counters (tenant_slug, counter_key, next_seq)
     values ($1, $2, 1)
     on conflict (tenant_slug, counter_key)
     do update set next_seq = pos_counters.next_seq + 1
     returning next_seq`,
    [tenantSlug, counterKey]
  );
  return Number(res.rows[0].next_seq);
}

/**
 * Serialize sales per (tenant, register) with a Postgres advisory lock so
 * stock decrements, receipt sequences and shift totals can't interleave.
 * The lock is session-scoped on a dedicated pool client held for the saga.
 */
async function withRegisterLock<T>(tenantSlug: string, registerId: string | null, fn: () => Promise<T>): Promise<T> {
  const pool = getPool();
  if (!pool) return fn();
  const client = await pool.connect();
  const key = `pos:${tenantSlug}:${registerId ?? ""}`;
  try {
    await client.query("select pg_advisory_lock(hashtext($1))", [key]);
    try {
      return await fn();
    } finally {
      await client.query("select pg_advisory_unlock(hashtext($1))", [key]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

/**
 * POS sale saga:
 *  1. Validate everything up-front (shift, products, stock, serials/lots, tenders).
 *  2. Anchor a pos_sales row in 'pending' before any financial write.
 *  3. Invoice → per-tender payments + receipt JE → stock decrement.
 *  4. Any mid-saga failure compensates: reversing JEs, voided invoice,
 *     reversed payments, stock restored — then the sale is marked 'failed'.
 */
export async function createPosSale(
  tenantSlug: string,
  input: {
    items: PosItem[];
    tenders?: PosTender[];
    paymentMethod?: "cash" | "pos" | "bank_transfer" | "mobile_money";
    amountTendered?: number;
    customerCode?: string;
    customerName?: string;
    warehouseId?: string;
    registerId?: string;
    branchId?: string;
    localInvoiceNo?: string;
    priceListId?: string;
    discount?: { amount?: number; pct?: number; reason: string };
    loyaltyRedeemPoints?: number;
    idempotencyKey?: string;
    createdBy?: string;
    notes?: string;
  }
): Promise<{ id: string; invoiceId: string; invoiceNumber: string; total: number; receiptNo: string; change: number; alreadyExisted?: boolean }> {
  const sql = SQL;
  await ensurePosTables(sql);
  if (!input.items?.length) throw new Error("POS sale requires at least one item");

  // Idempotent replay: same key (or offline local invoice no.) => return the original sale.
  if (input.idempotencyKey || input.localInvoiceNo) {
    const dup = (await sql`
      select id, invoice_id, receipt_no, total_amount, change_due, status
      from pos_sales
      where tenant_slug = ${tenantSlug}
        and ((${input.idempotencyKey ?? null}::text is not null and idempotency_key = ${input.idempotencyKey ?? null})
             or (${input.localInvoiceNo ?? null}::text is not null and local_invoice_no = ${input.localInvoiceNo ?? null}))
    `) as any[];
    if (dup.length && dup[0].status === "completed") {
      const inv = (await sql`select invoice_number from finance_invoices where id = ${dup[0].invoice_id}`) as any[];
      return {
        id: dup[0].id, invoiceId: dup[0].invoice_id, invoiceNumber: inv[0]?.invoice_number ?? "",
        total: Number(dup[0].total_amount), receiptNo: dup[0].receipt_no,
        change: Number(dup[0].change_due ?? 0), alreadyExisted: true,
      };
    }
    if (dup.length && dup[0].status !== "failed") {
      throw new Error("A sale with this idempotency key is already in progress");
    }
  }

  return withRegisterLock(tenantSlug, input.registerId ?? null, async () => {
    const cfg = await getPosConfig(tenantSlug);
    const register = await getRegister(tenantSlug, input.registerId);
    if (input.registerId && !register) throw new Error("Register not found or inactive");

    const shift = await getOpenShift(tenantSlug, input.registerId ?? null);
    if (!shift) throw new Error("No open shift — open a shift before selling");

    const today = new Date().toISOString().split("T")[0];
    const currency = await getTenantCurrency(tenantSlug);

    // ---- Phase 1: pure validation + resolution (no writes) ----------------
    const skus = input.items.map((i) => i.sku);
    const products = (await sql`
      select id, sku, name, sale_price, unit_cost, tracking, current_stock, allow_negative_stock
      from inventory_products
      where tenant_slug = ${tenantSlug} and sku = any(${skus})
    `) as any[];
    const bySku = new Map(products.map((p) => [p.sku, p]));

    // Optional customer-linked price list.
    const priceListItems = new Map<string, number>();
    const priceListId = input.priceListId ?? null;
    if (priceListId) {
      const pli = (await sql`
        select sku, price from pos_price_list_items pli
        join pos_price_lists pl on pl.id = pli.price_list_id
        where pli.tenant_slug = ${tenantSlug} and pli.price_list_id = ${priceListId}
          and pl.tenant_slug = ${tenantSlug} and pl.is_active
      `) as any[];
      for (const r of pli) priceListItems.set(r.sku, Number(r.price));
    }

    let customerName = input.customerName ?? null;
    let customerId: string | null = null;
    if (input.customerCode) {
      const cust = (await sql`
        select id, name, metadata from finance_customers
        where tenant_slug = ${tenantSlug} and customer_code = ${input.customerCode}
      `) as any[];
      if (!cust.length) throw new Error(`Customer "${input.customerCode}" not found`);
      customerName = customerName ?? cust[0].name;
      customerId = cust[0].id;
      const metaPl = cust[0].metadata?.priceListId;
      if (!priceListId && metaPl) {
        const pli = (await sql`
          select sku, price from pos_price_list_items pli
          join pos_price_lists pl on pl.id = pli.price_list_id
          where pli.price_list_id = ${metaPl} and pli.tenant_slug = ${tenantSlug} and pl.is_active
        `) as any[];
        for (const r of pli) priceListItems.set(r.sku, Number(r.price));
      }
    }

    const vatRate = cfg.vatRate;
    const resolved: ResolvedLine[] = [];
    const priceOverrides: Array<{ sku: string; list: number; charged: number }> = [];

    for (const item of input.items) {
      const product = bySku.get(item.sku);
      if (!product) throw new Error(`Unknown SKU "${item.sku}"`);
      const qty = Number(item.quantity);
      if (!(qty > 0)) throw new Error(`Invalid quantity for "${item.sku}"`);

      // Stock gate (validated again atomically at decrement time).
      if (!product.allow_negative_stock && Number(product.current_stock) < qty) {
        throw new Error(`Insufficient stock for "${item.sku}": ${product.current_stock} available, ${qty} requested`);
      }

      // Price: explicit override (audited) -> price list -> sale_price.
      const listPrice = priceListItems.get(item.sku) ?? Number(product.sale_price ?? 0);
      const price = item.unitPrice ?? listPrice;
      if (!(price >= 0)) throw new Error(`No price for "${item.sku}"`);
      const overridden = item.unitPrice != null && item.unitPrice !== listPrice;
      if (overridden) priceOverrides.push({ sku: item.sku, list: listPrice, charged: item.unitPrice! });

      // Serial/lot rules — same validator the stock layer uses.
      const { validateMovementTracking } = await import("../inventory/lot-tracking");
      await validateMovementTracking(tenantSlug, {
        productSku: item.sku, movementType: "sale", quantity: qty, warehouseId: input.warehouseId,
      }, { serialNos: item.serialNos, lotNo: item.lotNo });

      const lineGross = r2(qty * price);
      const lineDiscount = r2(
        Math.min(lineGross, (item.discountAmount ?? 0) + (lineGross * (item.discountPct ?? 0)) / 100)
      );
      const taxableAmount = r2(lineGross - lineDiscount);
      const taxRate = item.taxExempt ? 0 : vatRate;
      resolved.push({
        sku: product.sku, name: product.name, qty, price, amount: lineGross,
        discount: lineDiscount, taxableAmount, taxRate,
        taxAmount: r2((taxableAmount * taxRate) / 100),
        cost: Number(product.unit_cost ?? 0), productId: product.id,
        tracking: product.tracking ?? "none",
        serialNos: item.serialNos, lotNo: item.lotNo, priceOverridden: overridden,
      });
    }

    // Time-boxed promotions add per-line discounts before order-level math.
    const { applyPromotions } = await import("./promotions");
    const appliedPromos = await applyPromotions(tenantSlug, resolved);
    if (appliedPromos.length) {
      for (const l of resolved) {
        l.taxableAmount = r2(l.qty * l.price - l.discount);
        l.taxAmount = r2((l.taxableAmount * l.taxRate) / 100);
      }
    }

    const subtotal = r2(resolved.reduce((s, l) => s + l.taxableAmount, 0));

    // Order-level discount + loyalty redemption (both require reasons/customer).
    let orderDiscount = 0;
    const discountReasons: string[] = [];
    if (input.discount && (input.discount.amount || input.discount.pct)) {
      if (!input.discount.reason?.trim()) throw new Error("A discount reason is required");
      orderDiscount += r2(Math.min(subtotal, (input.discount.amount ?? 0) + (subtotal * (input.discount.pct ?? 0)) / 100));
      discountReasons.push(input.discount.reason.trim());
    }
    let loyaltyRedeemed = 0;
    if (input.loyaltyRedeemPoints && input.loyaltyRedeemPoints > 0) {
      if (!input.customerCode) throw new Error("Loyalty redemption requires a customer");
      if (!cfg.loyalty.enabled) throw new Error("Loyalty is not enabled for this tenant");
      const bal = (await sql`
        select coalesce(sum(case when type in ('earn','adjust') then points else -points end), 0)::numeric as pts
        from pos_loyalty_txns where tenant_slug = ${tenantSlug} and customer_code = ${input.customerCode}
      `) as any[];
      const points = Number(bal[0]?.pts ?? 0);
      if (points < input.loyaltyRedeemPoints) {
        throw new Error(`Insufficient loyalty points: ${points} available, ${input.loyaltyRedeemPoints} requested`);
      }
      loyaltyRedeemed = input.loyaltyRedeemPoints;
      orderDiscount += r2(Math.min(subtotal - orderDiscount, input.loyaltyRedeemPoints * cfg.loyalty.redeemValue));
      discountReasons.push("loyalty redemption");
    }
    const discountTotal = r2(resolved.reduce((s, l) => s + l.discount, 0) + orderDiscount);

    // Allocate the order discount pro-rata into each line's taxable amount so
    // the invoice's per-line VAT stays exact (lines drive the JE credits).
    // The last line absorbs any rounding residue.
    const targetNet = r2(Math.max(0, subtotal - orderDiscount));
    const netFactor = subtotal > 0 ? targetNet / subtotal : 0;
    let net = 0;
    let tax = 0;
    resolved.forEach((l, i) => {
      const lineNet = i === resolved.length - 1 ? r2(targetNet - net) : r2(l.taxableAmount * netFactor);
      (l as any).allocatedNet = lineNet;
      l.taxAmount = r2(lineNet * (l.taxRate / 100));
      net = r2(net + lineNet);
      tax = r2(tax + l.taxAmount);
    });
    let total = r2(net + tax);

    // Resolve foreign-currency tenders into base amounts via the rate table.
    const rawTenders: PosTender[] = input.tenders?.length
      ? input.tenders
      : [{ method: input.paymentMethod ?? "cash", amount: total, tendered: input.amountTendered }];
    const { getExchangeRate } = await import("../finance/currency");
    const tenders: Array<PosTender & { amount: number }> = [];
    for (const t of rawTenders) {
      if (t.amountForeign != null && t.currency && t.currency.toUpperCase() !== currency) {
        const rate = t.exchangeRate
          ?? await getExchangeRate(tenantSlug, t.currency.toUpperCase(), today);
        if (!rate) throw new Error(`No exchange rate for ${t.currency}`);
        const base = r2(t.amountForeign / rate);
        tenders.push({ ...t, amount: base, exchangeRate: rate, currency: t.currency.toUpperCase() });
      } else {
        if (t.amount == null) throw new Error("Tender amount is required");
        tenders.push({ ...t, amount: t.amount });
      }
    }
    const allCash = tenders.every((t) => t.method === "cash");
    let rounding = 0;
    if (cfg.cashRoundingStep > 0 && allCash) {
      const step = cfg.cashRoundingStep;
      const rounded = Math.round(total / step) * step;
      rounding = r2(rounded - total);
      total = rounded;
    }

    // Tender validation: applied amounts must equal the payable total;
    // cash tenders may exceed it (change); non-cash tenders cannot overpay.
    let applied = 0;
    let tenderedTotal = 0;
    let change = 0;
    for (const t of tenders) {
      applied = r2(applied + t.amount);
      if (t.method === "cash" && t.tendered != null) {
        if (t.tendered < t.amount) throw new Error("Cash tendered cannot be less than the amount applied");
        tenderedTotal = r2(tenderedTotal + t.tendered);
        change = r2(change + (t.tendered - t.amount));
      } else if (t.tendered != null && t.tendered > t.amount) {
        throw new Error(`Tendered amount cannot exceed the applied amount for ${t.method}`);
      }
    }
    if (Math.abs(applied - total) > 0.01) {
      throw new Error(`Tendered amounts (${applied}) do not cover the total (${total})`);
    }
    // Cash tenders where tendered wasn't specified implicitly cover their amount.
    if (tenderedTotal === 0) tenderedTotal = applied;

    // Sequential receipt number per register — atomic under the register lock.
    const regCode = register?.code ?? "MAIN";
    const receiptSeq = await nextReceiptSeq(tenantSlug, `receipt:${regCode}`);
    const receiptNo = `POS-${regCode}-${String(receiptSeq).padStart(6, "0")}`;

    const id = `pos_${randomUUID().slice(0, 10)}`;
    const cardFeePct = cfg.cardFeePct;

    // Branch resolution: explicit input → register → warehouse's branch.
    // Tags the sale and its JEs for multi-store P&L (Venditium cost-center model).
    const branchId = input.branchId
      ?? register?.branchId
      ?? (input.warehouseId
        ? ((await sql`select branch_id from inventory_warehouses where id = ${input.warehouseId} and tenant_slug = ${tenantSlug} limit 1`) as any[])[0]?.branch_id
        : null)
      ?? null;
    // Every sale gets a local invoice number (online too) — the dedup identity
    // for offline-first replay, matching Venditium's LOCAL-* convention.
    const localInvoiceNo = input.localInvoiceNo ?? `LOCAL-${regCode}-${String(receiptSeq).padStart(6, "0")}`;

    // Posting preflight (Venditium checkout pattern): abort before any write
    // if a required posting account is misconfigured — better a clean error
    // than a partial GL post.
    const { POSTING_KEYS, resolvePostingAccount, assertPostingAccountsConfigured } = await import("../finance/posting-settings");
    const requiredKeys: (keyof typeof POSTING_KEYS)[] = ["sales_income"];
    for (const t of tenders) {
      const k = `pos_tender_${t.method}` as keyof typeof POSTING_KEYS;
      if (k in POSTING_KEYS && !requiredKeys.includes(k)) requiredKeys.push(k);
    }
    if (loyaltyRedeemed > 0 || (cfg.loyalty.enabled && input.customerCode)) {
      requiredKeys.push("loyalty_points_liability", "loyalty_discount_expense");
    }
    await assertPostingAccountsConfigured(tenantSlug, requiredKeys);

    // ---- Phase 2: anchor the sale BEFORE any financial write --------------
    await sql`
      insert into pos_sales (
        id, tenant_slug, invoice_id, warehouse_id, shift_id, register_id, branch_id,
        receipt_no, receipt_seq, local_invoice_no, status, payment_method, tenders,
        amount_tendered, change_due, discount_amount, discount_reason,
        rounding_amount, customer_name, customer_code, idempotency_key,
        items, net_amount, tax_amount, total_amount, promotions, created_by, created_at
      ) values (
        ${id}, ${tenantSlug}, null, ${input.warehouseId ?? null}, ${shift.id}, ${input.registerId ?? null}, ${branchId},
        ${receiptNo}, ${receiptSeq}, ${localInvoiceNo}, 'pending', ${tenders[0].method}, ${JSON.stringify(tenders)},
        ${tenderedTotal}, ${change}, ${discountTotal},
        ${[appliedPromos.join("; "), discountReasons.join("; ")].filter(Boolean).join(" | ") || null},
        ${rounding}, ${customerName ?? null}, ${input.customerCode ?? null}, ${input.idempotencyKey ?? null},
        ${JSON.stringify(resolved)}, ${net}, ${tax}, ${total},
        ${appliedPromos.length ? appliedPromos : null}, ${input.createdBy ?? null}, now()
      )
    `;

    // ---- Phase 3: financial saga with compensation ------------------------
    let invoiceId: string | null = null;
    const paymentIds: string[] = [];
    const entryIds: string[] = [];
    let stockDone = false;
    try {
      const invoice = await insertFinanceInvoice({
        tenantSlug,
        customerName: customerName ?? "Walk-in Customer",
        customerCode: input.customerCode ?? undefined,
        customerId: customerId ?? undefined,
        branchId: branchId ?? undefined,
        invoiceNumber: `INV-${receiptNo}`,
        issuedDate: today,
        dueDate: today,
        currency,
        status: "sent",
        notes: `POS sale ${receiptNo}`,
        lineItems: resolved.map((l) => ({
          description: `${l.name} x${l.qty}${l.discount ? ` (−${r2(l.discount)})` : ""}`,
          quantity: l.qty,
          unitPrice: l.price,
          amount: (l as any).allocatedNet ?? l.taxableAmount,
          accountCode: GL_ACCOUNTS.SALES_REVENUE,
          taxRate: l.taxRate || undefined,
        })),
        amount: total,
        balanceDue: total,
        metadata: { posSaleId: id, receiptNo, orderDiscount, discountReasons },
      } as any);
      invoiceId = invoice.id;
      // Capture the invoice's JE for potential reversal.
      const invJes = (await sql`
        select id from journal_entries where reference_id = ${invoiceId} and tenant_slug = ${tenantSlug}
      `) as any[];
      for (const e of invJes) entryIds.push(e.id);

      // Per-tender payment rows (card tenders carry the processor fee).
      let totalFees = 0;
      for (const t of tenders) {
        const fee = t.method === "pos" ? r2((t.amount * cardFeePct) / 100) : 0;
        totalFees = r2(totalFees + fee);
        const pay = await createPayment({
          tenantSlug,
          customerId: customerId ?? undefined,
          invoiceId,
          reference: receiptNo,
          grossAmount: t.amount,
          fees: fee,
          method: t.method,
          paymentDate: today,
          confirmationDetails: `POS sale ${receiptNo}${t.reference ? ` — ${t.reference}` : ""}`,
          status: "successful",
          linkedInvoices: [invoiceId],
          metadata: { pos: true, shiftId: shift.id, registerId: input.registerId ?? null, tendered: t.tendered ?? t.amount },
        });
        paymentIds.push((pay as any).id);
      }

      // Receipt JE: Dr tender accounts (net of card fees) + fees + rounding,
      // Cr AR for the invoiced amount.
      const jeLines: any[] = [];
      for (const t of tenders) {
        const fee = t.method === "pos" ? r2((t.amount * cardFeePct) / 100) : 0;
        const postingKey = `pos_tender_${t.method}` as keyof typeof POSTING_KEYS;
        const tenderAccount = t.accountCode
          ?? (postingKey in POSTING_KEYS
            ? await resolvePostingAccount(tenantSlug, postingKey)
            : TENDER_ACCOUNT[t.method])
          ?? GL_ACCOUNTS.CASH;
        jeLines.push({
          accountCode: tenderAccount,
          debitAmount: r2(t.amount - fee), creditAmount: 0,
          description: `POS ${receiptNo} — ${t.method}`,
        });
        if (fee > 0) {
          jeLines.push({
            accountCode: GL_ACCOUNTS.BANK_CHARGES, debitAmount: fee, creditAmount: 0,
            description: `Card processing fee ${receiptNo}`,
          });
        }
      }
      if (rounding !== 0) {
        jeLines.push(
          rounding < 0
            ? { accountCode: "6900", debitAmount: -rounding, creditAmount: 0, description: "Cash rounding" }
            : { accountCode: "6900", debitAmount: 0, creditAmount: rounding, description: "Cash rounding" }
        );
      }
      jeLines.push({
        accountCode: GL_ACCOUNTS.ACCOUNTS_RECEIVABLE, debitAmount: 0, creditAmount: r2(total - rounding),
        description: `Clear AR ${receiptNo}`,
      });
      const receiptJe = await postGLEntry({
        tenantSlug,
        entryDate: today,
        journalType: "SYSTEM",
        referenceType: "pos_sale",
        referenceId: receiptNo,
        branchId,
        description: `POS receipt ${receiptNo}`,
        status: "POSTED",
        lines: jeLines,
      });
      if ((receiptJe as any)?.id) entryIds.push((receiptJe as any).id);

      await sql`
        update finance_invoices set balance_due = 0, status = 'paid', updated_at = now()
        where id = ${invoiceId} and tenant_slug = ${tenantSlug}
      `;

      // Stock decrement per line (serial/lot + oversell enforced inside).
      for (const l of resolved) {
        await recordStockMovement(tenantSlug, {
          productSku: l.sku,
          productName: l.name,
          movementType: "sale",
          quantity: l.qty,
          unitCost: l.cost,
          referenceType: "pos_sale",
          referenceId: receiptNo,
          warehouseId: input.warehouseId,
          branchId,
          serialNos: l.serialNos,
          lotNo: l.lotNo,
          notes: `POS sale ${receiptNo}`,
        });
      }
      stockDone = true;

      // Loyalty: redeem then earn on the final total.
      if (loyaltyRedeemed > 0 && input.customerCode) {
        await sql`
          insert into pos_loyalty_txns (id, tenant_slug, customer_code, sale_id, type, points, value, note)
          values (${`plt_${randomUUID().slice(0, 10)}`}, ${tenantSlug}, ${input.customerCode}, ${id},
                  'redeem', ${loyaltyRedeemed}, ${loyaltyRedeemed * cfg.loyalty.redeemValue}, ${`Redeemed on ${receiptNo}`})
        `;
      }
      let loyaltyEarned = 0;
      if (cfg.loyalty.enabled && input.customerCode) {
        loyaltyEarned = Math.floor(total / cfg.loyalty.earnDivisor);
        if (loyaltyEarned > 0) {
          await sql`
            insert into pos_loyalty_txns (id, tenant_slug, customer_code, sale_id, type, points, value, note)
            values (${`plt_${randomUUID().slice(0, 10)}`}, ${tenantSlug}, ${input.customerCode}, ${id},
                    'earn', ${loyaltyEarned}, ${total}, ${`Earned on ${receiptNo}`})
          `;
        }
      }

      // Loyalty GL: redeemed points are funded by the liability (re-grosses
      // revenue netted down by the redemption discount); earned points accrue
      // the expense and the outstanding-points liability.
      if (loyaltyRedeemed > 0) {
        const liabAcc = await resolvePostingAccount(tenantSlug, "loyalty_points_liability");
        const je = await postGLEntry({
          tenantSlug,
          entryDate: today,
          journalType: "SYSTEM",
          referenceType: "pos_sale_loyalty_redeem",
          referenceId: receiptNo,
          branchId,
          description: `Loyalty redemption ${receiptNo}`,
          lines: [
            { accountCode: liabAcc, debitAmount: r2(loyaltyRedeemed * cfg.loyalty.redeemValue), creditAmount: 0, description: "Points redeemed — liability relief" },
            { accountCode: GL_ACCOUNTS.SALES_REVENUE, debitAmount: 0, creditAmount: r2(loyaltyRedeemed * cfg.loyalty.redeemValue), description: "Redemption funded by points liability" },
          ],
        });
        if ((je as any)?.id) entryIds.push((je as any).id);
      }
      if (loyaltyEarned > 0) {
        const expAcc = await resolvePostingAccount(tenantSlug, "loyalty_discount_expense");
        const liabAcc = await resolvePostingAccount(tenantSlug, "loyalty_points_liability");
        const je = await postGLEntry({
          tenantSlug,
          entryDate: today,
          journalType: "SYSTEM",
          referenceType: "pos_sale_loyalty_earn",
          referenceId: receiptNo,
          branchId,
          description: `Loyalty accrual ${receiptNo}`,
          lines: [
            { accountCode: expAcc, debitAmount: r2(loyaltyEarned * cfg.loyalty.redeemValue), creditAmount: 0, description: "Points earned — discount expense" },
            { accountCode: liabAcc, debitAmount: 0, creditAmount: r2(loyaltyEarned * cfg.loyalty.redeemValue), description: "Outstanding points liability" },
          ],
        });
        if ((je as any)?.id) entryIds.push((je as any).id);
      }

      await sql`
        update pos_sales set status = 'completed', invoice_id = ${invoiceId},
               card_fees = ${totalFees}
        where id = ${id} and tenant_slug = ${tenantSlug}
      `;

      if (discountTotal > 0 || priceOverrides.length || appliedPromos.length) {
        await logPosAudit(tenantSlug, {
          action: "sale_discounts", actor: input.createdBy, entityType: "pos_sale", entityId: id,
          detail: { discountTotal, reasons: discountReasons, priceOverrides, promotions: appliedPromos },
        });
      }

      return { id, invoiceId, invoiceNumber: invoice.invoiceNumber, total, receiptNo, change };
    } catch (err: any) {
      // Compensation: keep books consistent — reverse posted JEs, void the
      // invoice, mark payments reversed, restore stock, then fail the sale.
      try {
        if (paymentIds.length) {
          await sql`
            update finance_payments set status = 'reversed'
            where tenant_slug = ${tenantSlug} and id = any(${paymentIds})
          `;
        }
        for (const eid of entryIds) {
          await reverseGLEntry(eid, `POS sale ${receiptNo} failed: ${err.message}`).catch(() => {});
        }
        if (invoiceId) {
          await sql`
            update finance_invoices set status = 'void', balance_due = 0, updated_at = now()
            where id = ${invoiceId} and tenant_slug = ${tenantSlug}
          `;
        }
        if (stockDone) {
          for (const l of resolved) {
            await recordStockMovement(tenantSlug, {
              productSku: l.sku,
              productName: l.name,
              movementType: "return",
              quantity: l.qty,
              unitCost: l.cost,
              referenceType: "pos_sale_compensation",
              referenceId: receiptNo,
              warehouseId: input.warehouseId,
              branchId,
              serialNos: l.serialNos,
              lotNo: l.lotNo,
              notes: `Compensation — failed POS sale ${receiptNo}`,
            }).catch(() => {});
          }
        }
      } finally {
        await sql`
          update pos_sales set status = 'failed', error = ${String(err.message ?? err).slice(0, 500)}
          where id = ${id} and tenant_slug = ${tenantSlug}
        `;
      }
      throw err;
    }
  });
}

export async function getPosSale(
  tenantSlug: string,
  ref: { id?: string; receiptNo?: string; invoiceId?: string }
) {
  const sql = SQL;
  await ensurePosTables(sql);
  const rows = (await sql`
    select * from pos_sales
    where tenant_slug = ${tenantSlug}
      and (${ref.id ?? null}::text is null or id = ${ref.id ?? null})
      and (${ref.receiptNo ?? null}::text is null or receipt_no = ${ref.receiptNo ?? null})
      and (${ref.invoiceId ?? null}::text is null or invoice_id = ${ref.invoiceId ?? null})
    order by created_at desc limit 1
  `) as any[];
  return rows[0] ? normalizeSale(rows[0]) : null;
}

function normalizeSale(r: any) {
  return {
    id: r.id,
    invoiceId: r.invoice_id,
    warehouseId: r.warehouse_id,
    shiftId: r.shift_id,
    registerId: r.register_id,
    branchId: r.branch_id ?? null,
    localInvoiceNo: r.local_invoice_no ?? null,
    receiptNo: r.receipt_no,
    receiptSeq: r.receipt_seq == null ? null : Number(r.receipt_seq),
    status: r.status,
    paymentMethod: r.payment_method,
    tenders: r.tenders ? (typeof r.tenders === "string" ? JSON.parse(r.tenders) : r.tenders) : null,
    amountTendered: r.amount_tendered == null ? null : Number(r.amount_tendered),
    changeDue: r.change_due == null ? null : Number(r.change_due),
    discountAmount: Number(r.discount_amount ?? 0),
    discountReason: r.discount_reason,
    roundingAmount: Number(r.rounding_amount ?? 0),
    cardFees: Number(r.card_fees ?? 0),
    customerName: r.customer_name,
    customerCode: r.customer_code,
    items: typeof r.items === "string" ? JSON.parse(r.items) : r.items,
    netAmount: Number(r.net_amount),
    taxAmount: Number(r.tax_amount),
    totalAmount: Number(r.total_amount),
    error: r.error,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

export async function listPosSales(
  tenantSlug: string,
  opts: { from?: string; to?: string; shiftId?: string; registerId?: string; status?: string; limit?: number } = {}
) {
  const sql = SQL;
  await ensurePosTables(sql);
  const rows = (await sql`
    select * from pos_sales
    where tenant_slug = ${tenantSlug}
      and status <> 'failed'
      and (${opts.status ?? null}::text is null or status = ${opts.status ?? null})
      and (${opts.shiftId ?? null}::text is null or shift_id = ${opts.shiftId ?? null})
      and (${opts.registerId ?? null}::text is null or register_id = ${opts.registerId ?? null})
      and (${opts.from ?? null}::date is null or created_at >= ${opts.from ?? null}::date)
      and (${opts.to ?? null}::date is null or created_at < (${opts.to ?? null}::date + 1))
    order by created_at desc limit ${Math.min(opts.limit ?? 100, 500)}
  `) as any[];
  return rows.map(normalizeSale);
}

export async function posDailySummary(tenantSlug: string, date?: string) {
  const sql = SQL;
  await ensurePosTables(sql);
  const day = date ?? new Date().toISOString().split("T")[0];
  const rows = (await sql`
    select m.method, count(distinct m.id)::int as sales,
           sum(m.amount)::numeric as total
    from (
      select (t.value ->> 'method') as method, (t.value ->> 'amount')::numeric as amount, s.id
      from pos_sales s cross join lateral jsonb_array_elements(s.tenders) t
      where s.tenant_slug = ${tenantSlug} and s.status = 'completed' and s.tenders is not null
        and s.created_at >= ${day}::date and s.created_at < (${day}::date + 1)
      union all
      select s.payment_method, s.total_amount, s.id
      from pos_sales s
      where s.tenant_slug = ${tenantSlug} and s.status = 'completed' and s.tenders is null
        and s.created_at >= ${day}::date and s.created_at < (${day}::date + 1)
    ) m group by m.method
  `) as any[];
  const agg = (await sql`
    select count(*)::int as sales, sum(net_amount)::numeric as net,
           sum(tax_amount)::numeric as tax, sum(total_amount)::numeric as total,
           sum(discount_amount)::numeric as discounts, sum(card_fees)::numeric as fees
    from pos_sales
    where tenant_slug = ${tenantSlug} and status = 'completed'
      and created_at >= ${day}::date and created_at < (${day}::date + 1)
  `) as any[];
  return {
    date: day,
    byMethod: rows.map((r) => ({ paymentMethod: r.method, sales: r.sales, total: Number(r.total) })),
    net: Number(agg[0]?.net ?? 0),
    tax: Number(agg[0]?.tax ?? 0),
    discounts: Number(agg[0]?.discounts ?? 0),
    cardFees: Number(agg[0]?.fees ?? 0),
    total: Number(agg[0]?.total ?? 0),
    sales: Number(agg[0]?.sales ?? 0),
  };
}
