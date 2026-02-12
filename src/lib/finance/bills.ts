/**
 * Bills & Payables Service
 * Manages vendor bills, accounts payable, and aging
 */

import { randomUUID } from "node:crypto";
import { db, sql as SQL, SqlClient } from "@/lib/sql-client";
import { createBillJournalEntry } from "./accounting";

export interface BillItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  lineAmount: number;
  accountCode?: string;
  metadata?: Record<string, unknown>;
}

export interface Bill {
  id: string;
  tenantSlug: string;
  billNumber: string;
  vendorId: string;
  poId?: string;
  branchId?: string;
  billDate: string;
  dueDate?: string;
  currency: string;
  subtotal: number;
  taxes: number;
  total: number;
  balanceDue: number;
  status: "draft" | "open" | "partially_paid" | "paid" | "overdue" | "cancelled";
  items: BillItem[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BillRecord {
  id: string;
  tenant_slug: string;
  bill_number: string;
  vendor_id: string;
  po_id?: string;
  branch_id?: string;
  bill_date: string;
  due_date?: string;
  currency: string;
  subtotal: number;
  taxes: number;
  total: number;
  balance_due: number;
  status: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BillItemRecord {
  id: string;
  bill_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  line_amount: number;
  account_code?: string;
  metadata?: Record<string, unknown>;
}

export interface AgingReport {
  vendorId: string;
  vendorName: string;
  current: number; // 0-30 days
  days31: number; // 31-60 days
  days61: number; // 61-90 days
  days90: number; // 90+ days
  total: number;
}

// using imported SQL from sql-client

export async function ensureBillTables(sql = SQL) {
  // Tables should already exist from migration, but ensure for development
  try {
    await sql`select 1 from bills limit 1`;
    await sql`select 1 from bill_items limit 1`;
  } catch {
    // Tables don't exist, run migration logic
    console.warn("Bill tables not found, ensure migration has run");
  }
}

function normalizeBill(record: BillRecord, items: BillItemRecord[]): Bill {
  return {
    id: record.id,
    tenantSlug: record.tenant_slug,
    billNumber: record.bill_number,
    vendorId: record.vendor_id,
    poId: record.po_id,
    branchId: record.branch_id,
    billDate: record.bill_date,
    dueDate: record.due_date,
    currency: record.currency,
    subtotal: Number(record.subtotal),
    taxes: Number(record.taxes),
    total: Number(record.total),
    balanceDue: Number(record.balance_due),
    status: record.status as Bill["status"],
    items: items.map(item => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      taxRate: item.tax_rate ? Number(item.tax_rate) : undefined,
      lineAmount: Number(item.line_amount),
      accountCode: item.account_code,
      metadata: item.metadata
    })),
    metadata: record.metadata,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

export async function listBills(filters: {
  tenantSlug: string;
  vendorId?: string;
  status?: string;
  branchId?: string;
  overdueOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<Bill[]> {
  const sql = SQL;
  await ensureBillTables(sql);
  
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  const whereConditions: any[] = [];
  whereConditions.push(sql`tenant_slug = ${filters.tenantSlug}`);
  
  if (filters.vendorId) {
    whereConditions.push(sql`vendor_id = ${filters.vendorId}`);
  }
  
  if (filters.status) {
    whereConditions.push(sql`status = ${filters.status}`);
  }
  
  if (filters.branchId) {
    whereConditions.push(sql`branch_id = ${filters.branchId}`);
  }
  
  if (filters.overdueOnly) {
    whereConditions.push(sql`due_date < current_date and balance_due > 0`);
  }

  const whereClause = whereConditions.length > 0 
    ? sql`where ${db.join(whereConditions, ' and ')}`
    : sql``;

  const records = (await sql`
    select * from bills 
    ${whereClause}
    order by bill_date desc, created_at desc
    limit ${limit} offset ${offset}
  `) as BillRecord[];

  if (!records.length) return [];

  const items = (await sql`
    select * from bill_items 
    where bill_id = any(${records.map(r => r.id)})
    order by id
  `) as BillItemRecord[];

  const itemsByBill: Record<string, BillItemRecord[]> = {};
  items.forEach(item => {
    itemsByBill[item.bill_id] = itemsByBill[item.bill_id] || [];
    itemsByBill[item.bill_id].push(item);
  });

  return records.map(record => normalizeBill(record, itemsByBill[record.id] || []));
}

export async function getBill(billId: string): Promise<Bill | null> {
  const sql = SQL;
  await ensureBillTables(sql);

  const records = (await sql`
    select * from bills where id = ${billId} limit 1
  `) as BillRecord[];

  if (!records.length) return null;

  const items = (await sql`
    select * from bill_items where bill_id = ${billId} order by id
  `) as BillItemRecord[];

  return normalizeBill(records[0], items);
}

export async function createBill(payload: {
  tenantSlug: string;
  vendorId: string;
  poId?: string;
  branchId?: string;
  billDate: string;
  dueDate?: string;
  currency?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
    accountCode?: string;
  }>;
  metadata?: Record<string, unknown>;
}): Promise<Bill> {
  const sql = SQL;
  await ensureBillTables(sql);

  const id = randomUUID();
  const billNumber = `BILL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const currency = payload.currency || 'NGN';
  
  // Calculate totals
  const subtotal = payload.items.reduce((sum, item) => 
    sum + (item.quantity * item.unitPrice), 0);
  const taxes = payload.items.reduce((sum, item) => {
    const lineAmount = item.quantity * item.unitPrice;
    const taxAmount = item.taxRate ? lineAmount * (item.taxRate / 100) : 0;
    return sum + taxAmount;
  }, 0);
  const total = subtotal + taxes;

  const [record] = (await sql`
    insert into bills (
      id, tenant_slug, bill_number, vendor_id, po_id, branch_id,
      bill_date, due_date, currency, subtotal, taxes, total, balance_due,
      status, metadata, created_at, updated_at
    ) values (
      ${id}, ${payload.tenantSlug}, ${billNumber}, ${payload.vendorId},
      ${payload.poId || null}, ${payload.branchId || null},
      ${payload.billDate}, ${payload.dueDate || null}, ${currency},
      ${subtotal}, ${taxes}, ${total}, ${total},
      'open', ${payload.metadata || null}, now(), now()
    ) returning *
  `) as BillRecord[];

  // Insert bill items
  const itemRecords = await Promise.all(payload.items.map(async (item, index) => {
    const lineAmount = item.quantity * item.unitPrice;
    const taxAmount = item.taxRate ? lineAmount * (item.taxRate / 100) : 0;
    const totalLineAmount = lineAmount + taxAmount;
    
    const [itemRecord] = (await sql`
      insert into bill_items (
        id, bill_id, description, quantity, unit_price, tax_rate,
        line_amount, account_code, metadata
      ) values (
        ${randomUUID()}, ${id}, ${item.description}, ${item.quantity},
        ${item.unitPrice}, ${item.taxRate || null}, ${totalLineAmount},
        ${item.accountCode || null}, null
      ) returning *
    `) as BillItemRecord[];
    
    return itemRecord;
  }));

  const bill = normalizeBill(record, itemRecords);

  // Create accounting journal entry
  try {
    await createBillJournalEntry(id, bill);
  } catch (accountingError) {
    console.error("Failed to create journal entry for bill:", accountingError);
    // Don't fail the bill creation if accounting fails
  }

  return bill;
}

export async function updateBill(billId: string, updates: Partial<Bill>): Promise<Bill | null> {
  const sql = SQL;
  await ensureBillTables(sql);

  const [record] = (await sql`
    update bills set
      status = coalesce(${updates.status || null}, status),
      due_date = coalesce(${updates.dueDate || null}, due_date),
      balance_due = coalesce(${updates.balanceDue !== undefined ? updates.balanceDue : null}, balance_due),
      metadata = coalesce(${updates.metadata || null}, metadata),
      updated_at = now()
    where id = ${billId}
    returning *
  `) as BillRecord[];

  if (!record) return null;

  const items = (await sql`
    select * from bill_items where bill_id = ${billId} order by id
  `) as BillItemRecord[];

  return normalizeBill(record, items);
}

export async function deleteBill(billId: string): Promise<boolean> {
  const sql = SQL;
  await ensureBillTables(sql);

  const result = await db.query<{ count: number }>(`delete from bills where id = $1`, [billId]);
  return result.count > 0;
}

export async function convertPOToBill(poId: string, payload: {
  billDate: string;
  dueDate?: string;
  currency?: string;
  metadata?: Record<string, unknown>;
}): Promise<Bill | null> {
  const sql = SQL;
  await ensureBillTables(sql);

  // Get PO details
  const poRecords = (await sql`
    select * from purchase_orders where id = ${poId} limit 1
  `) as any[];

  if (!poRecords.length) return null;

  const po = poRecords[0];
  
  // Get PO items
  const poItems = (await sql`
    select * from purchase_order_items where po_id = ${poId}
  `) as any[];

  // Create bill from PO
  return createBill({
    tenantSlug: po.tenant_slug,
    vendorId: po.vendor_id,
    poId: poId,
    branchId: po.branch_id,
    billDate: payload.billDate,
    dueDate: payload.dueDate,
    currency: payload.currency || po.currency,
    items: poItems.map(item => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      taxRate: item.tax_rate ? Number(item.tax_rate) : undefined,
      accountCode: item.account_code
    })),
    metadata: payload.metadata
  });
}

export async function getAgingReport(tenantSlug: string): Promise<AgingReport[]> {
  const sql = SQL;
  await ensureBillTables(sql);

  const today = new Date().toISOString().split('T')[0];
  
  const results = (await sql`
    with aging as (
      select 
        b.vendor_id,
        v.legal_name as vendor_name,
        case 
          when b.due_date >= current_date - interval '30 days' then b.balance_due
          else 0
        end as current,
        case 
          when b.due_date >= current_date - interval '60 days' 
          and b.due_date < current_date - interval '30 days' then b.balance_due
          else 0
        end as days31,
        case 
          when b.due_date >= current_date - interval '90 days' 
          and b.due_date < current_date - interval '60 days' then b.balance_due
          else 0
        end as days61,
        case 
          when b.due_date < current_date - interval '90 days' then b.balance_due
          else 0
        end as days90,
        b.balance_due
      from bills b
      join vendors v on b.vendor_id = v.id
      where b.tenant_slug = ${tenantSlug}
      and b.status in ('open', 'partially_paid')
      and b.balance_due > 0
    )
    select 
      vendor_id,
      vendor_name,
      sum(current) as current,
      sum(days31) as days31,
      sum(days61) as days61,
      sum(days90) as days90,
      sum(balance_due) as total
    from aging
    group by vendor_id, vendor_name
    order by total desc
  `) as any[];

  return results.map(row => ({
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    current: Number(row.current),
    days31: Number(row.days31),
    days61: Number(row.days61),
    days90: Number(row.days90),
    total: Number(row.total)
  }));
}

export async function updateBillStatuses(tenantSlug: string): Promise<number> {
  const sql = SQL;
  await ensureBillTables(sql);

  const result = await sql`
    update bills 
    set status = case 
      when balance_due <= 0 then 'paid'
      when balance_due < total then 'partially_paid'
      when due_date < current_date and balance_due > 0 then 'overdue'
      else status
    end,
    updated_at = now()
    where tenant_slug = ${tenantSlug}
    and status in ('open', 'partially_paid')
  `;

  // `sql` returns rows; use db.query to get affected row count
  const r = await db.query(
    `update bills 
     set status = case 
       when balance_due <= 0 then 'paid'
       when balance_due < total then 'partially_paid'
       when due_date < current_date and balance_due > 0 then 'overdue'
       else status
     end,
     updated_at = now()
     where tenant_slug = $1
     and status in ('open', 'partially_paid')`,
    [tenantSlug]
  );

  return r.rowCount;
}
