/**
 * Vendor Integration Service
 * Manages vendor master data and lookups
 */

import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";

export interface VendorRecord {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  taxId?: string;
  accountNumber?: string;
  bankCode?: string;
  bankName?: string;
  paymentTerms: "net30" | "net60" | "net90" | "immediate" | "cod";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}


export interface VendorLookupResult {
  found: boolean;
  vendor?: VendorRecord;
  similar?: VendorRecord[];
}

export interface VendorIntegrationConfig {
  vendorApiUrl?: string;
  vendorApiKey?: string;
  syncFrequency?: number; // Minutes
}

/**
 * Sample vendor data (in production, connect to external vendor database)
 */
const SAMPLE_VENDORS: VendorRecord[] = [
  {
    id: "vend-arik-001",
    code: "ARIK001",
    name: "Arik Air",
    email: "billing@arikair.com",
    phone: "+234-1-2716-611",
    city: "Lagos",
    country: "Nigeria",
    taxId: "TAX-ARIK001",
    paymentTerms: "net30",
    isActive: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "vend-shoprite-001",
    code: "SHOPRITE001",
    name: "Shoprite Supermarket",
    email: "vendor@shoprite.com.ng",
    phone: "+234-1-880-5000",
    city: "Lagos",
    country: "Nigeria",
    taxId: "TAX-SHOPRITE001",
    paymentTerms: "immediate",
    isActive: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "vend-adobe-001",
    code: "ADOBE001",
    name: "Adobe Inc.",
    email: "accounting@adobe.com",
    phone: "+1-408-536-6000",
    country: "United States",
    taxId: "TAX-ADOBE001",
    paymentTerms: "net60",
    isActive: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
];

/**
 * Look up vendor by name or code
 */
export async function lookupVendor(
  query: string,
  type: "name" | "code" | "email" = "name"
): Promise<VendorLookupResult> {
  // Prefer DB-backed lookup when connection configured
  try {
    const sql = getSql();
    await sql`
      select 1
    `;

    const q = `%${query}%`;
    const rows = (await sql`
      select id, code, name, email, phone, address, city, state, country, tax_id, account_number, bank_code, bank_name, payment_terms, is_active, created_at, updated_at
      from vendors
      where ${type === "name" ? sql`name ilike ${q}` : type === "code" ? sql`code ilike ${q}` : sql`email ilike ${q}`}
      order by name asc
      limit 10
    `) as any[];

    if (rows.length === 0) {
      return { found: false };
    }

    // exact match check
    const exact = rows.find((r) => {
      const val = (type === "name" ? r.name : type === "code" ? r.code : r.email) || "";
      return val.toLowerCase() === query.toLowerCase();
    });

    if (exact) {
      return {
        found: true,
        vendor: {
          id: exact.id,
          code: exact.code,
          name: exact.name,
          email: exact.email,
          phone: exact.phone,
          address: exact.address,
          city: exact.city,
          state: exact.state,
          country: exact.country,
          taxId: exact.tax_id,
          accountNumber: exact.account_number,
          bankCode: exact.bank_code,
          bankName: exact.bank_name,
          paymentTerms: exact.payment_terms,
          isActive: exact.is_active,
          createdAt: exact.created_at,
          updatedAt: exact.updated_at,
        },
      };
    }

    const similar = rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      email: r.email,
      phone: r.phone,
      address: r.address,
      city: r.city,
      state: r.state,
      country: r.country,
      taxId: r.tax_id,
      accountNumber: r.account_number,
      bankCode: r.bank_code,
      bankName: r.bank_name,
      paymentTerms: r.payment_terms,
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return { found: false, similar };
  } catch (err) {
    // Fallback to sample vendor data if DB unavailable
    try {
      const lowerQuery = query.toLowerCase();

      // Exact match
      let vendor = SAMPLE_VENDORS.find((v) => {
        switch (type) {
          case "code":
            return v.code.toLowerCase() === lowerQuery;
          case "email":
            return v.email?.toLowerCase() === lowerQuery;
          case "name":
          default:
            return v.name.toLowerCase() === lowerQuery;
        }
      });

      if (vendor) {
        return { found: true, vendor };
      }

      // Fuzzy match
      const similar = SAMPLE_VENDORS.filter((v) => {
        switch (type) {
          case "code":
            return v.code.toLowerCase().includes(lowerQuery);
          case "email":
            return v.email?.toLowerCase().includes(lowerQuery) || false;
          case "name":
          default:
            return v.name.toLowerCase().includes(lowerQuery);
        }
      }).slice(0, 5);

      return { found: false, similar: similar.length > 0 ? similar : undefined };
    } catch (error) {
      console.error("Vendor lookup failed:", error);
      return { found: false };
    }
  }
}

/**
 * Get all active vendors
 */
export async function listVendors(
  filters?: {
    isActive?: boolean;
    paymentTerms?: string;
    country?: string;
  }
): Promise<VendorRecord[]> {
  // Try DB first
  try {
    const sql = getSql();
    await ensureVendorTables(sql);

    const whereClauses: Array<any> = [];
    if (filters?.isActive !== undefined) {
      whereClauses.push(sql`is_active = ${filters.isActive}`);
    }
    if (filters?.paymentTerms) {
      whereClauses.push(sql`payment_terms = ${filters.paymentTerms}`);
    }
    if (filters?.country) {
      whereClauses.push(sql`country = ${filters.country}`);
    }

    const rows = (await sql`
      select id, code, name, email, phone, address, city, state, country, tax_id, account_number, bank_code, bank_name, payment_terms, is_active, created_at, updated_at
      from vendors
      ${whereClauses.length ? sql`where ${sql.join(whereClauses, sql` and `)}` : sql``}
      order by name asc
      limit 200
    `) as any[];

    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      email: r.email,
      phone: r.phone,
      address: r.address,
      city: r.city,
      state: r.state,
      country: r.country,
      taxId: r.tax_id,
      accountNumber: r.account_number,
      bankCode: r.bank_code,
      bankName: r.bank_name,
      paymentTerms: r.payment_terms,
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch (err) {
    // Fallback to samples
    let vendors = SAMPLE_VENDORS;

    if (filters?.isActive !== undefined) {
      vendors = vendors.filter((v) => v.isActive === filters.isActive);
    }

    if (filters?.paymentTerms) {
      vendors = vendors.filter((v) => v.paymentTerms === filters.paymentTerms);
    }

    if (filters?.country) {
      vendors = vendors.filter((v) => v.country === filters.country);
    }

    return vendors;
  }
}

/**
 * Get vendor by ID
 */
export async function getVendor(vendorId: string): Promise<VendorRecord | null> {
  try {
    const sql = getSql();
    await ensureVendorTables(sql);

    const rows = (await sql`
      select id, code, name, email, phone, address, city, state, country, tax_id, account_number, bank_code, bank_name, payment_terms, is_active, created_at, updated_at
      from vendors
      where id = ${vendorId}
      limit 1
    `) as any[];

    if (!rows.length) return null;

    const r = rows[0];
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      email: r.email,
      phone: r.phone,
      address: r.address,
      city: r.city,
      state: r.state,
      country: r.country,
      taxId: r.tax_id,
      accountNumber: r.account_number,
      bankCode: r.bank_code,
      bankName: r.bank_name,
      paymentTerms: r.payment_terms,
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  } catch (err) {
    return SAMPLE_VENDORS.find((v) => v.id === vendorId) || null;
  }
}

export async function createVendor(payload: Partial<VendorRecord>): Promise<VendorRecord> {
  try {
    const sql = getSql();
    await ensureVendorTables(sql);

    const id = payload.id ?? randomUUID();
    const now = new Date().toISOString();

    const [row] = (await sql`
      insert into vendors (
        id, code, name, email, phone, address, city, state, country, tax_id, account_number, bank_code, bank_name, payment_terms, is_active, created_at, updated_at
      ) values (
        ${id}, ${payload.code ?? null}, ${payload.name ?? null}, ${payload.email ?? null}, ${payload.phone ?? null}, ${payload.address ?? null}, ${payload.city ?? null}, ${payload.state ?? null}, ${payload.country ?? null}, ${payload.taxId ?? null}, ${payload.accountNumber ?? null}, ${payload.bankCode ?? null}, ${payload.bankName ?? null}, ${payload.paymentTerms ?? "net30"}, ${payload.isActive ?? true}, ${now}, ${now}
      ) returning *
    `) as any[];

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      city: row.city,
      state: row.state,
      country: row.country,
      taxId: row.tax_id,
      accountNumber: row.account_number,
      bankCode: row.bank_code,
      bankName: row.bank_name,
      paymentTerms: row.payment_terms,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (err) {
    // Fallback: return sample created object
    const now = new Date().toISOString();
    const vendor: VendorRecord = {
      id: payload.id ?? `vend-${randomUUID()}`,
      code: payload.code ?? `V-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      name: payload.name ?? "New Vendor",
      email: payload.email,
      phone: payload.phone,
      address: payload.address,
      city: payload.city,
      state: payload.state,
      country: payload.country,
      taxId: payload.taxId,
      accountNumber: payload.accountNumber,
      bankCode: payload.bankCode,
      bankName: payload.bankName,
      paymentTerms: payload.paymentTerms ?? "net30",
      isActive: payload.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    SAMPLE_VENDORS.push(vendor);
    return vendor;
  }
}

export async function updateVendor(id: string, updates: Partial<VendorRecord>): Promise<VendorRecord | null> {
  try {
    const sql = getSql();
    await ensureVendorTables(sql);

    const [row] = (await sql`
      update vendors set
        code = coalesce(${updates.code ?? null}, code),
        name = coalesce(${updates.name ?? null}, name),
        email = coalesce(${updates.email ?? null}, email),
        phone = coalesce(${updates.phone ?? null}, phone),
        address = coalesce(${updates.address ?? null}, address),
        city = coalesce(${updates.city ?? null}, city),
        state = coalesce(${updates.state ?? null}, state),
        country = coalesce(${updates.country ?? null}, country),
        tax_id = coalesce(${updates.taxId ?? null}, tax_id),
        account_number = coalesce(${updates.accountNumber ?? null}, account_number),
        bank_code = coalesce(${updates.bankCode ?? null}, bank_code),
        bank_name = coalesce(${updates.bankName ?? null}, bank_name),
        payment_terms = coalesce(${updates.paymentTerms ?? null}, payment_terms),
        is_active = coalesce(${updates.isActive ?? null}, is_active),
        updated_at = now()
      where id = ${id}
      returning *
    `) as any[];

    if (!row) return null;

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      city: row.city,
      state: row.state,
      country: row.country,
      taxId: row.tax_id,
      accountNumber: row.account_number,
      bankCode: row.bank_code,
      bankName: row.bank_name,
      paymentTerms: row.payment_terms,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (err) {
    const idx = SAMPLE_VENDORS.findIndex((v) => v.id === id);
    if (idx === -1) return null;
    const existing = SAMPLE_VENDORS[idx];
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() } as VendorRecord;
    SAMPLE_VENDORS[idx] = updated;
    return updated;
  }
}

export async function deleteVendor(id: string): Promise<boolean> {
  try {
    const sql = getSql();
    await ensureVendorTables(sql);

    const res = await sql`
      delete from vendors where id = ${id}
    `;

    return res.count > 0;
  } catch (err) {
    const idx = SAMPLE_VENDORS.findIndex((v) => v.id === id);
    if (idx === -1) return false;
    SAMPLE_VENDORS.splice(idx, 1);
    return true;
  }
}

async function ensureVendorTables(sql: ReturnType<typeof getSql>) {
  try {
    await sql`
      create table if not exists vendors (
        id text primary key,
        code text,
        name text not null,
        email text,
        phone text,
        address text,
        city text,
        state text,
        country text,
        tax_id text,
        account_number text,
        bank_code text,
        bank_name text,
        payment_terms text default 'net30',
        is_active boolean default true,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      )
    `;

    await sql`create index if not exists vendors_name_idx on vendors (name)`;
    await sql`create index if not exists vendors_code_idx on vendors (code)`;
    await sql`create index if not exists vendors_tenant_idx on vendors (country)`;
  } catch (err) {
    console.error("ensureVendorTables failed:", err);
  }
}
/**
 * Get payment terms for vendor
 */
export async function getVendorPaymentTerms(vendorId: string): Promise<{
  terms: string;
  daysUntilDue: number;
}> {
  const vendor = await getVendor(vendorId);
  if (!vendor) {
    return { terms: "net30", daysUntilDue: 30 };
  }

  const termsDays: Record<string, number> = {
    immediate: 0,
    cod: 0,
    net30: 30,
    net60: 60,
    net90: 90,
  };

  return {
    terms: vendor.paymentTerms,
    daysUntilDue: termsDays[vendor.paymentTerms] || 30,
  };
}

/**
 * Validate vendor for payment
 */
export async function validateVendorForPayment(vendorId: string): Promise<{
  valid: boolean;
  reason?: string;
  missingFields?: string[];
}> {
  const vendor = await getVendor(vendorId);

  if (!vendor) {
    return { valid: false, reason: "Vendor not found" };
  }

  if (!vendor.isActive) {
    return { valid: false, reason: "Vendor is inactive" };
  }

  const missingFields: string[] = [];

  if (!vendor.email) missingFields.push("email");
  if (!vendor.accountNumber) missingFields.push("accountNumber");
  if (!vendor.bankCode) missingFields.push("bankCode");

  if (missingFields.length > 0) {
    return {
      valid: false,
      reason: "Missing required vendor information",
      missingFields,
    };
  }

  return { valid: true };
}

/**
 * Get vendor statistics
 */
export async function getVendorStats(): Promise<{
  totalVendors: number;
  activeVendors: number;
  byPaymentTerms: Record<string, number>;
  byCountry: Record<string, number>;
}> {
  const activeVendors = SAMPLE_VENDORS.filter((v) => v.isActive);

  const byPaymentTerms: Record<string, number> = {};
  const byCountry: Record<string, number> = {};

  SAMPLE_VENDORS.forEach((v) => {
    byPaymentTerms[v.paymentTerms] =
      (byPaymentTerms[v.paymentTerms] || 0) + 1;
    const country = v.country || "Unknown";
    byCountry[country] = (byCountry[country] || 0) + 1;
  });

  return {
    totalVendors: SAMPLE_VENDORS.length,
    activeVendors: activeVendors.length,
    byPaymentTerms,
    byCountry,
  };
}

/**
 * Format vendor info for display
 */
export function formatVendorInfo(vendor: VendorRecord): string {
  const parts = [vendor.name];
  if (vendor.city) parts.push(vendor.city);
  if (vendor.country) parts.push(vendor.country);
  return parts.join(" | ");
}

/**
 * Get vendor payment window (when payment is due)
 */
export function getPaymentWindow(
  invoiceDate: string,
  paymentTerms: string
): { dueDate: string; daysUntilDue: number; isOverdue: boolean } {
  const date = new Date(invoiceDate);
  const termsDays: Record<string, number> = {
    immediate: 0,
    cod: 0,
    net30: 30,
    net60: 60,
    net90: 90,
  };

  const days = termsDays[paymentTerms] || 30;
  date.setDate(date.getDate() + days);

  const dueDate = date.toISOString();
  const today = new Date();
  const daysUntilDue = Math.ceil(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  const isOverdue = daysUntilDue < 0;

  return { dueDate, daysUntilDue, isOverdue };
}
