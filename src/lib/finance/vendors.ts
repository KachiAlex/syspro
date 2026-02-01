/**
 * Vendor Integration Service
 * Manages vendor master data and lookups
 */

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

/**
 * Get vendor by ID
 */
export async function getVendor(vendorId: string): Promise<VendorRecord | null> {
  return (
    SAMPLE_VENDORS.find((v) => v.id === vendorId) || null
  );
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
