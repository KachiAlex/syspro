/**
 * Vendor Integration Service
 * Manages vendor master data and lookups
 */

import { randomUUID } from "crypto";
import { db, sql as SQL, SqlClient } from "../sql-client";

export interface VendorRecord {
  id: string;
  tenantSlug?: string;
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

// DB row shape (snake_case) returned by SQL queries
interface VendorRowDB {
  id: string;
  tenant_slug?: string;
  vendor_code: string;
  legal_name: string;
  display_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  tax_id?: string;
  bank_details?: any;
  default_payment_terms?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

function extractBankDetails(bankDetails: any): { accountNumber?: string; bankCode?: string; bankName?: string } {
  if (!bankDetails) return {};
  const bd = typeof bankDetails === "string" ? JSON.parse(bankDetails) : bankDetails;
  return {
    accountNumber: bd?.accountNumber ?? bd?.account_number,
    bankCode: bd?.bankCode ?? bd?.bank_code,
    bankName: bd?.bankName ?? bd?.bank_name,
  };
}

function mapVendorRow(r: VendorRowDB): VendorRecord {
  const bank = extractBankDetails(r.bank_details);
  return {
    id: r.id,
    tenantSlug: r.tenant_slug,
    code: r.vendor_code,
    name: r.display_name ?? r.legal_name,
    email: r.email,
    phone: r.phone,
    address: r.address,
    city: r.city,
    state: r.state,
    country: r.country,
    taxId: r.tax_id,
    accountNumber: bank.accountNumber,
    bankCode: bank.bankCode,
    bankName: bank.bankName,
    paymentTerms: (r.default_payment_terms as VendorRecord['paymentTerms']) ?? 'net30',
    isActive: r.status ? r.status === 'active' : true,
    createdAt: r.created_at ?? new Date().toISOString(),
    updatedAt: r.updated_at ?? new Date().toISOString(),
  };
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
  try {
    const sql = SQL;
    await ensureVendorTables(sql);

    const like = `%${query}%`;
    const dbRows = (await db.query<VendorRowDB>(
      `select id, tenant_slug, vendor_code, legal_name, display_name, email, phone, address, city, state, country, tax_id, bank_details, default_payment_terms, status, created_at, updated_at
       from vendors
       where vendor_code ilike $1 or legal_name ilike $1 or display_name ilike $1
       limit 10`,
      [like]
    )).rows;

    if (dbRows.length > 0) {
      const vendors = dbRows.map(mapVendorRow);
      const lowerQuery = query.toLowerCase();
      const exact = vendors.find((v) => {
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
      if (exact) {
        return { found: true, vendor: exact };
      }
      return { found: false, similar: vendors.slice(0, 5) };
    }
    return { found: false, similar: [] };
  } catch (error) {
    console.error("Vendor DB lookup failed, falling back to sample data:", error);
    try {
      const lowerQuery = query.toLowerCase();
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
    } catch (fallbackError) {
      console.error("Vendor lookup fallback failed:", fallbackError);
      return { found: false };
    }
  }
}

/**
 * Get all active vendors
 */
export async function listVendors(
  filters?: {
    tenantSlug?: string;
    isActive?: boolean;
    paymentTerms?: string;
    country?: string;
  }
): Promise<VendorRecord[]> {
  try {
    const sql = SQL;
    await ensureVendorTables(sql);

    const whereClauses: Array<any> = [];
    if (filters?.tenantSlug) {
      whereClauses.push(sql`tenant_slug = ${filters.tenantSlug}`);
    }
    if (filters?.isActive !== undefined) {
      whereClauses.push(sql`status = ${filters.isActive ? 'active' : 'inactive'}`);
    }
    if (filters?.paymentTerms) {
      whereClauses.push(sql`default_payment_terms = ${filters.paymentTerms}`);
    }
    if (filters?.country) {
      whereClauses.push(sql`country = ${filters.country}`);
    }

    const rows = await SQL<VendorRowDB>`
      select id, tenant_slug, vendor_code, legal_name, display_name, email, phone, address, city, state, country, tax_id, bank_details, default_payment_terms, status, created_at, updated_at
      from vendors
      ${whereClauses.length ? sql`where ${(sql as any).join(whereClauses, sql` and `)}` : sql``}
      order by display_name asc
      limit 200
    `;

    return rows.map(mapVendorRow);
  } catch (err) {
    throw err;
  }
}

/**
 * Get vendor by ID
 */
export async function getVendor(vendorId: string): Promise<VendorRecord | null> {
  try {
    const sql = SQL;
    await ensureVendorTables(sql);

    const rows = await SQL<VendorRowDB>`
      select id, vendor_code, legal_name, display_name, email, phone, address, city, state, country, tax_id, bank_details, default_payment_terms, status, created_at, updated_at
      from vendors
      where id = ${vendorId}
      limit 1
    `;

    if (!rows.length) return null;
    return mapVendorRow(rows[0]);
  } catch (err) {
    throw err;
  }
}

export async function createVendor(payload: Partial<VendorRecord> & { tenantSlug?: string }): Promise<VendorRecord> {
  try {
    const sql = SQL;
    await ensureVendorTables(sql);

    const id = payload.id ?? randomUUID();
    const now = new Date().toISOString();

    const bankDetails = JSON.stringify({
      accountNumber: payload.accountNumber ?? null,
      bankCode: payload.bankCode ?? null,
      bankName: payload.bankName ?? null,
    });

    const [row] = await SQL<VendorRowDB>`
      insert into vendors (
        id, tenant_slug, vendor_code, legal_name, display_name, email, phone, address, city, state, country, tax_id, bank_details, default_payment_terms, status, created_at, updated_at
      ) values (
        ${id}, ${payload.tenantSlug ?? null}, ${payload.code ?? null}, ${payload.name ?? null}, ${payload.name ?? null}, ${payload.email ?? null}, ${payload.phone ?? null}, ${payload.address ?? null}, ${payload.city ?? null}, ${payload.state ?? null}, ${payload.country ?? null}, ${payload.taxId ?? null}, ${bankDetails}::jsonb, ${payload.paymentTerms ?? "net30"}, ${payload.isActive === false ? 'inactive' : 'active'}, ${now}, ${now}
      )
      returning *
    `;
    return mapVendorRow(row);
  } catch (err) {
    throw err;
  }
}

export async function updateVendor(id: string, updates: Partial<VendorRecord>): Promise<VendorRecord | null> {
  try {
    const sql = SQL;
    await ensureVendorTables(sql);

    const hasBankUpdate = updates.accountNumber !== undefined || updates.bankCode !== undefined || updates.bankName !== undefined;
    const bankDetails = hasBankUpdate
      ? JSON.stringify({
          accountNumber: updates.accountNumber ?? null,
          bankCode: updates.bankCode ?? null,
          bankName: updates.bankName ?? null,
        })
      : null;

    const statusValue = updates.isActive !== undefined ? (updates.isActive ? 'active' : 'inactive') : null;

    const params = [
      updates.code ?? null,
      updates.name ?? null,
      updates.name ?? null,
      updates.email ?? null,
      updates.phone ?? null,
      updates.address ?? null,
      updates.city ?? null,
      updates.state ?? null,
      updates.country ?? null,
      updates.taxId ?? null,
      bankDetails,
      updates.paymentTerms ?? null,
      statusValue,
      id,
    ];

    const queryText = `update vendors set
      vendor_code = coalesce($1, vendor_code),
      legal_name = coalesce($2, legal_name),
      display_name = coalesce($3, display_name),
      email = coalesce($4, email),
      phone = coalesce($5, phone),
      address = coalesce($6, address),
      city = coalesce($7, city),
      state = coalesce($8, state),
      country = coalesce($9, country),
      tax_id = coalesce($10, tax_id),
      bank_details = coalesce($11::jsonb, bank_details),
      default_payment_terms = coalesce($12, default_payment_terms),
      status = coalesce($13, status),
      updated_at = now()
      where id = $14
      returning *`;

    const res = await db.query<VendorRowDB>(queryText, params);
    const row = res.rows[0];

    if (!row) {
      return null;
    }

    return mapVendorRow(row);
  } catch (err) {
    throw err;
  }
}

export async function deleteVendor(id: string): Promise<boolean> {
  try {
    const sql = SQL;
    await ensureVendorTables(sql);

    const res = await db.query<{ count: number }>(`delete from vendors where id = $1`, [id]);
    return res.count > 0;
  } catch (err) {
    throw err;
  }
}

async function ensureVendorTables(sql: SqlClient) {
  try {
    const createTableSql = `
      create table if not exists vendors (
        id text primary key,
        tenant_slug text,
        vendor_code text not null,
        legal_name text not null,
        display_name text,
        vendor_type text not null default 'goods' check (vendor_type in ('service','goods')),
        status text not null default 'active' check (status in ('active','inactive','blacklisted')),
        tax_id text,
        default_currency text not null default 'NGN',
        default_payment_terms text,
        default_expense_account text,
        default_tax_rules jsonb,
        bank_details jsonb,
        metadata jsonb,
        created_by text,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      )
    `;

    await db.query(createTableSql);

    // Add tenant_slug if missing on existing tables
    try {
      await db.query(`alter table vendors add column if not exists tenant_slug text`);
    } catch (e: any) {
      console.warn('ensureVendorTables: ignoring alter table error:', e.message);
    }

    // Add email/phone/address/city/state/country columns for compatibility
    try {
      await db.query(`alter table vendors add column if not exists email text`);
      await db.query(`alter table vendors add column if not exists phone text`);
      await db.query(`alter table vendors add column if not exists address text`);
      await db.query(`alter table vendors add column if not exists city text`);
      await db.query(`alter table vendors add column if not exists state text`);
      await db.query(`alter table vendors add column if not exists country text`);
    } catch (e: any) {
      console.warn('ensureVendorTables: ignoring alter table error:', e.message);
    }

    // Create indexes individually and tolerate missing-column errors (some DBs
    // may have different schemas in CI/dev). Ignore undefined_column (42703).
    const indexes = [
      'create index if not exists vendors_display_name_idx on vendors (display_name)',
      'create index if not exists vendors_vendor_code_idx on vendors (vendor_code)',
      'create index if not exists vendors_tenant_idx on vendors (tenant_slug)'
    ];

    for (const idxSql of indexes) {
      try {
        await db.query(idxSql);
      } catch (e: any) {
        const msg = (e && e.message) || String(e);
        if ((e && e.code === '42703') || msg.includes('column "display_name" does not exist') || msg.includes('column "vendor_code" does not exist')) {
          // Log and continue — schema mismatch in remote DB, fall back to in-memory store.
          console.warn('ensureVendorTables: ignoring index error:', msg);
          continue;
        }
        throw e;
      }
    }
  } catch (err) {
    console.error('ensureVendorTables failed:', err);
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
export async function getVendorStats(tenantSlug?: string): Promise<{
  totalVendors: number;
  activeVendors: number;
  byPaymentTerms: Record<string, number>;
  byCountry: Record<string, number>;
}> {
  let vendors: VendorRecord[];
  try {
    const sql = SQL;
    await ensureVendorTables(sql);
    const rows = await SQL<VendorRowDB>`
      select id, vendor_code, legal_name, display_name, email, phone, address, city, state, country, tax_id, bank_details, default_payment_terms, status, created_at, updated_at
      from vendors
      limit 1000
    `;
    vendors = rows.map(mapVendorRow);
  } catch (err) {
    throw err;
  }

  const activeVendors = vendors.filter((v) => v.isActive);

  const byPaymentTerms: Record<string, number> = {};
  const byCountry: Record<string, number> = {};

  vendors.forEach((v) => {
    byPaymentTerms[v.paymentTerms] = (byPaymentTerms[v.paymentTerms] || 0) + 1;
    const country = v.country || "Unknown";
    byCountry[country] = (byCountry[country] || 0) + 1;
  });

  return {
    totalVendors: vendors.length,
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
