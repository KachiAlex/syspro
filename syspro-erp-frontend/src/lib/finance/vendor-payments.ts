/**
 * Vendor Payments Service
 * Manages payments to vendors, payment applications, and balance tracking
 */

import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { createPaymentJournalEntry } from "./accounting";

export interface VendorPayment {
  id: string;
  tenantSlug: string;
  paymentNumber: string;
  vendorId: string;
  method: "bank_transfer" | "cash" | "corporate_card" | "other";
  currency: string;
  amount: number;
  appliedAmount: number;
  unappliedAmount: number;
  status: "draft" | "posted" | "reconciled" | "cancelled";
  paymentDate: string;
  bankDetails?: Record<string, unknown>;
  applications: PaymentApplication[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface PaymentApplication {
  id: string;
  paymentId: string;
  billId: string;
  appliedAmount: number;
  createdAt: string;
}

export interface VendorPaymentRecord {
  id: string;
  tenant_slug: string;
  payment_number: string;
  vendor_id: string;
  method: string;
  currency: string;
  amount: number;
  applied_amount: number;
  unapplied_amount: number;
  status: string;
  payment_date: string;
  bank_details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface PaymentApplicationRecord {
  id: string;
  payment_id: string;
  bill_id: string;
  applied_amount: number;
  created_at: string;
}

const SQL = getSql();

export async function ensurePaymentTables(sql = SQL) {
  try {
    await sql`select 1 from vendor_payments limit 1`;
    await sql`select 1 from vendor_payment_applications limit 1`;
  } catch {
    console.warn("Payment tables not found, ensure migration has run");
  }
}

function normalizePayment(record: VendorPaymentRecord, applications: PaymentApplicationRecord[]): VendorPayment {
  return {
    id: record.id,
    tenantSlug: record.tenant_slug,
    paymentNumber: record.payment_number,
    vendorId: record.vendor_id,
    method: record.method as VendorPayment["method"],
    currency: record.currency,
    amount: Number(record.amount),
    appliedAmount: Number(record.applied_amount),
    unappliedAmount: Number(record.unapplied_amount),
    status: record.status as VendorPayment["status"],
    paymentDate: record.payment_date,
    bankDetails: record.bank_details,
    applications: applications.map(app => ({
      id: app.id,
      paymentId: app.payment_id,
      billId: app.bill_id,
      appliedAmount: Number(app.applied_amount),
      createdAt: app.created_at
    })),
    metadata: record.metadata,
    createdAt: record.created_at
  };
}

export async function listVendorPayments(filters: {
  tenantSlug: string;
  vendorId?: string;
  status?: string;
  method?: string;
  limit?: number;
  offset?: number;
}): Promise<VendorPayment[]> {
  const sql = SQL;
  await ensurePaymentTables(sql);
  
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
  
  if (filters.method) {
    whereConditions.push(sql`method = ${filters.method}`);
  }

  const whereClause = whereConditions.length > 0 
    ? sql`where ${sql.join(whereConditions, sql` and `)}`
    : sql``;

  const records = (await sql`
    select * from vendor_payments 
    ${whereClause}
    order by payment_date desc, created_at desc
    limit ${limit} offset ${offset}
  `) as VendorPaymentRecord[];

  if (!records.length) return [];

  const applications = (await sql`
    select * from vendor_payment_applications 
    where payment_id = any(${records.map(r => r.id)})
    order by created_at
  `) as PaymentApplicationRecord[];

  const applicationsByPayment: Record<string, PaymentApplicationRecord[]> = {};
  applications.forEach(app => {
    applicationsByPayment[app.payment_id] = applicationsByPayment[app.payment_id] || [];
    applicationsByPayment[app.payment_id].push(app);
  });

  return records.map(record => normalizePayment(record, applicationsByPayment[record.id] || []));
}

export async function getVendorPayment(paymentId: string): Promise<VendorPayment | null> {
  const sql = SQL;
  await ensurePaymentTables(sql);

  const records = (await sql`
    select * from vendor_payments where id = ${paymentId} limit 1
  `) as VendorPaymentRecord[];

  if (!records.length) return null;

  const applications = (await sql`
    select * from vendor_payment_applications where payment_id = ${paymentId} order by created_at
  `) as PaymentApplicationRecord[];

  return normalizePayment(records[0], applications);
}

export async function createVendorPayment(payload: {
  tenantSlug: string;
  vendorId: string;
  method: "bank_transfer" | "cash" | "corporate_card" | "other";
  amount: number;
  paymentDate: string;
  currency?: string;
  bankDetails?: Record<string, unknown>;
  applications?: Array<{
    billId: string;
    appliedAmount: number;
  }>;
  metadata?: Record<string, unknown>;
}): Promise<VendorPayment> {
  const sql = SQL;
  await ensurePaymentTables(sql);

  const id = randomUUID();
  const paymentNumber = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const currency = payload.currency || 'NGN';

  const [record] = (await sql`
    insert into vendor_payments (
      id, tenant_slug, payment_number, vendor_id, method, currency,
      amount, applied_amount, unapplied_amount, status, payment_date,
      bank_details, metadata, created_at
    ) values (
      ${id}, ${payload.tenantSlug}, ${paymentNumber}, ${payload.vendorId},
      ${payload.method}, ${currency}, ${payload.amount}, ${0}, ${payload.amount},
      'draft', ${payload.paymentDate}, ${payload.bankDetails || null},
      ${payload.metadata || null}, now()
    ) returning *
  `) as VendorPaymentRecord[];

  // Process applications if provided
  let applications: PaymentApplicationRecord[] = [];
  if (payload.applications && payload.applications.length > 0) {
    const totalApplied = payload.applications.reduce((sum, app) => sum + app.appliedAmount, 0);
    
    if (totalApplied > payload.amount) {
      throw new Error("Total applied amount cannot exceed payment amount");
    }

    applications = await Promise.all(payload.applications.map(async (app) => {
      const [appRecord] = (await sql`
        insert into vendor_payment_applications (
          id, payment_id, bill_id, applied_amount, created_at
        ) values (
          ${randomUUID()}, ${id}, ${app.billId}, ${app.appliedAmount}, now()
        ) returning *
      `) as PaymentApplicationRecord[];
      
      return appRecord;
    }));

    // Update payment applied amounts
    await sql`
      update vendor_payments 
      set applied_amount = ${totalApplied}, 
          unapplied_amount = ${payload.amount - totalApplied}
      where id = ${id}
    `;

    // Update bill balances
    await Promise.all(payload.applications.map(async (app) => {
      await sql`
        update bills 
        set balance_due = balance_due - ${app.appliedAmount},
            updated_at = now()
        where id = ${app.billId}
      `;
    }));
  }

  const payment = normalizePayment(record, applications);

  // Create accounting journal entry
  try {
    await createPaymentJournalEntry(id, payment);
  } catch (accountingError) {
    console.error("Failed to create journal entry for payment:", accountingError);
    // Don't fail the payment creation if accounting fails
  }

  return payment;
}

export async function updateVendorPayment(paymentId: string, updates: Partial<VendorPayment>): Promise<VendorPayment | null> {
  const sql = SQL;
  await ensurePaymentTables(sql);

  const [record] = (await sql`
    update vendor_payments set
      status = coalesce(${updates.status || null}, status),
      metadata = coalesce(${updates.metadata || null}, metadata)
    where id = ${paymentId}
    returning *
  `) as VendorPaymentRecord[];

  if (!record) return null;

  const applications = (await sql`
    select * from vendor_payment_applications where payment_id = ${paymentId} order by created_at
  `) as PaymentApplicationRecord[];

  return normalizePayment(record, applications);
}

export async function deleteVendorPayment(paymentId: string): Promise<boolean> {
  const sql = SQL;
  await ensurePaymentTables(sql);

  // Get payment details to reverse applications
  const payment = await getVendorPayment(paymentId);
  if (!payment) return false;

  // Reverse bill balance updates
  await Promise.all(payment.applications.map(async (app) => {
    await sql`
      update bills 
      set balance_due = balance_due + ${app.appliedAmount},
          updated_at = now()
      where id = ${app.billId}
    `;
  }));

  // Delete payment (cascade will delete applications)
  const result = await sql`delete from vendor_payments where id = ${paymentId}`;
  return result.count > 0;
}

export async function applyPaymentToBill(paymentId: string, billId: string, appliedAmount: number): Promise<VendorPayment | null> {
  const sql = SQL;
  await ensurePaymentTables(sql);

  // Get payment and bill details
  const payment = await getVendorPayment(paymentId);
  if (!payment) {
    throw new Error("Payment not found");
  }

  const billRecords = (await sql`
    select * from bills where id = ${billId} limit 1
  `) as any[];

  if (!billRecords.length) {
    throw new Error("Bill not found");
  }

  const bill = billRecords[0];

  // Check if application amount is valid
  if (appliedAmount > payment.unappliedAmount) {
    throw new Error("Applied amount exceeds unapplied payment amount");
  }

  if (appliedAmount > Number(balance_due)) {
    throw new Error("Applied amount exceeds bill balance due");
  }

  // Create application
  const [appRecord] = (await sql`
    insert into vendor_payment_applications (
      id, payment_id, bill_id, applied_amount, created_at
    ) values (
      ${randomUUID()}, ${paymentId}, ${billId}, ${appliedAmount}, now()
    ) returning *
  `) as PaymentApplicationRecord[];

  // Update payment applied amounts
  const newAppliedAmount = payment.appliedAmount + appliedAmount;
  const newUnappliedAmount = payment.unappliedAmount - appliedAmount;
  
  await sql`
    update vendor_payments 
    set applied_amount = ${newAppliedAmount},
        unapplied_amount = ${newUnappliedAmount}
    where id = ${paymentId}
  `;

  // Update bill balance
  await sql`
    update bills 
    set balance_due = balance_due - ${appliedAmount},
        updated_at = now()
    where id = ${billId}
  `;

  // Return updated payment
  return getVendorPayment(paymentId);
}

export async function getVendorPaymentSummary(tenantSlug: string, vendorId?: string): Promise<{
  totalPayments: number;
  totalApplied: number;
  totalUnapplied: number;
  paymentCount: number;
}> {
  const sql = SQL;
  await ensurePaymentTables(sql);

  const whereClause = vendorId 
    ? sql`where tenant_slug = ${tenantSlug} and vendor_id = ${vendorId}`
    : sql`where tenant_slug = ${tenantSlug}`;

  const results = (await sql`
    select 
      sum(amount) as total_payments,
      sum(applied_amount) as total_applied,
      sum(unapplied_amount) as total_unapplied,
      count(*) as payment_count
    from vendor_payments
    ${whereClause}
    and status != 'cancelled'
  `) as any[];

  const result = results[0];
  return {
    totalPayments: Number(result.total_payments || 0),
    totalApplied: Number(result.total_applied || 0),
    totalUnapplied: Number(result.total_unapplied || 0),
    paymentCount: Number(result.payment_count || 0)
  };
}
