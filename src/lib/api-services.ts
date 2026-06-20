/**
 * HR Module API Service
 * Fetches and manages HR data from real APIs
 */

import { Employee, Bill, Vendor, Requisition, PurchaseOrder, Invoice } from "@/components/modules";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";

// ============================================================
// HR SERVICES
// ============================================================

export async function fetchEmployees(
  tenantSlug: string,
  filters?: {
    department?: string;
    status?: string;
    search?: string;
  },
  pagination?: { page: number; limit: number }
) {
  try {
    const params = new URLSearchParams({
      tenantSlug,
      ...(filters?.department && { department: filters.department }),
      ...(filters?.status && { status: filters.status }),
      ...(filters?.search && { search: filters.search }),
      ...(pagination?.page && { page: pagination.page.toString() }),
      ...(pagination?.limit && { limit: pagination.limit.toString() }),
    });

    const response = await fetch(`${API_BASE}/hr/employees?${params}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) throw new Error("Failed to fetch employees");
    return await response.json();
  } catch (error) {
    console.error("Error fetching employees:", error);
    throw error;
  }
}

export async function createEmployee(
  tenantSlug: string,
  employeeData: Partial<Employee>
) {
  try {
    const response = await fetch(`${API_BASE}/hr/employees?tenantSlug=${tenantSlug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(employeeData),
    });

    if (!response.ok) throw new Error("Failed to create employee");
    return await response.json();
  } catch (error) {
    console.error("Error creating employee:", error);
    throw error;
  }
}

export async function updateEmployee(
  tenantSlug: string,
  employeeId: string,
  updates: Partial<Employee>
) {
  try {
    const response = await fetch(
      `${API_BASE}/hr/employees/${employeeId}?tenantSlug=${tenantSlug}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) throw new Error("Failed to update employee");
    return await response.json();
  } catch (error) {
    console.error("Error updating employee:", error);
    throw error;
  }
}

export async function fetchDepartments(tenantSlug: string) {
  try {
    const response = await fetch(
      `${API_BASE}/hr/departments?tenantSlug=${tenantSlug}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) throw new Error("Failed to fetch departments");
    return await response.json();
  } catch (error) {
    console.error("Error fetching departments:", error);
    throw error;
  }
}

// ============================================================
// BILLS SERVICES
// ============================================================

export async function fetchBills(
  tenantSlug: string,
  filters?: {
    status?: string;
    vendor?: string;
    search?: string;
  },
  pagination?: { page: number; limit: number }
) {
  try {
    const params = new URLSearchParams({
      tenantSlug,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.vendor && { vendor: filters.vendor }),
      ...(filters?.search && { search: filters.search }),
      ...(pagination?.page && { page: pagination.page.toString() }),
      ...(pagination?.limit && { limit: pagination.limit.toString() }),
    });

    const response = await fetch(`${API_BASE}/finance/bills?${params}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) throw new Error("Failed to fetch bills");
    return await response.json();
  } catch (error) {
    console.error("Error fetching bills:", error);
    throw error;
  }
}

export async function createBill(
  tenantSlug: string,
  billData: Partial<Bill>
) {
  try {
    const response = await fetch(`${API_BASE}/finance/bills?tenantSlug=${tenantSlug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(billData),
    });

    if (!response.ok) throw new Error("Failed to create bill");
    return await response.json();
  } catch (error) {
    console.error("Error creating bill:", error);
    throw error;
  }
}

export async function processPayment(
  tenantSlug: string,
  billId: string,
  amount: number
) {
  try {
    const response = await fetch(
      `${API_BASE}/finance/bills/${billId}/payments?tenantSlug=${tenantSlug}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      }
    );

    if (!response.ok) throw new Error("Failed to process payment");
    return await response.json();
  } catch (error) {
    console.error("Error processing payment:", error);
    throw error;
  }
}

// ============================================================
// VENDORS SERVICES
// ============================================================

export async function fetchVendors(
  tenantSlug: string,
  filters?: {
    status?: string;
    category?: string;
    search?: string;
  },
  pagination?: { page: number; limit: number }
) {
  try {
    const params = new URLSearchParams({
      tenantSlug,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.category && { category: filters.category }),
      ...(filters?.search && { search: filters.search }),
      ...(pagination?.page && { page: pagination.page.toString() }),
      ...(pagination?.limit && { limit: pagination.limit.toString() }),
    });

    const response = await fetch(`${API_BASE}/vendors?${params}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) throw new Error("Failed to fetch vendors");
    return await response.json();
  } catch (error) {
    console.error("Error fetching vendors:", error);
    throw error;
  }
}

export async function createVendor(
  tenantSlug: string,
  vendorData: Partial<Vendor>
) {
  try {
    const response = await fetch(`${API_BASE}/vendors?tenantSlug=${tenantSlug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vendorData),
    });

    if (!response.ok) throw new Error("Failed to create vendor");
    return await response.json();
  } catch (error) {
    console.error("Error creating vendor:", error);
    throw error;
  }
}

// ============================================================
// PROCUREMENT SERVICES
// ============================================================

export async function fetchRequisitions(
  tenantSlug: string,
  filters?: {
    status?: string;
    department?: string;
  },
  pagination?: { page: number; limit: number }
) {
  try {
    const params = new URLSearchParams({
      tenantSlug,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.department && { department: filters.department }),
      ...(pagination?.page && { page: pagination.page.toString() }),
      ...(pagination?.limit && { limit: pagination.limit.toString() }),
    });

    const response = await fetch(`${API_BASE}/procurement/requisitions?${params}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) throw new Error("Failed to fetch requisitions");
    return await response.json();
  } catch (error) {
    console.error("Error fetching requisitions:", error);
    throw error;
  }
}

export async function approveRequisition(
  tenantSlug: string,
  requisitionId: string
) {
  try {
    const response = await fetch(
      `${API_BASE}/procurement/requisitions/${requisitionId}/approve?tenantSlug=${tenantSlug}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) throw new Error("Failed to approve requisition");
    return await response.json();
  } catch (error) {
    console.error("Error approving requisition:", error);
    throw error;
  }
}

// ============================================================
// PURCHASE ORDER SERVICES
// ============================================================

export async function fetchPurchaseOrders(
  tenantSlug: string,
  filters?: {
    status?: string;
    vendor?: string;
  },
  pagination?: { page: number; limit: number }
) {
  try {
    const params = new URLSearchParams({
      tenantSlug,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.vendor && { vendor: filters.vendor }),
      ...(pagination?.page && { page: pagination.page.toString() }),
      ...(pagination?.limit && { limit: pagination.limit.toString() }),
    });

    const response = await fetch(`${API_BASE}/procurement/purchase-orders?${params}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) throw new Error("Failed to fetch purchase orders");
    return await response.json();
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    throw error;
  }
}

// ============================================================
// INVOICES SERVICES
// ============================================================

export async function fetchInvoices(
  tenantSlug: string,
  filters?: {
    status?: string;
    customer?: string;
  },
  pagination?: { page: number; limit: number }
) {
  try {
    const params = new URLSearchParams({
      tenantSlug,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.customer && { customer: filters.customer }),
      ...(pagination?.page && { page: pagination.page.toString() }),
      ...(pagination?.limit && { limit: pagination.limit.toString() }),
    });

    const response = await fetch(`${API_BASE}/finance/invoices?${params}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) throw new Error("Failed to fetch invoices");
    return await response.json();
  } catch (error) {
    console.error("Error fetching invoices:", error);
    throw error;
  }
}

export async function createInvoice(
  tenantSlug: string,
  invoiceData: Partial<Invoice>
) {
  try {
    const response = await fetch(`${API_BASE}/finance/invoices?tenantSlug=${tenantSlug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invoiceData),
    });

    if (!response.ok) throw new Error("Failed to create invoice");
    return await response.json();
  } catch (error) {
    console.error("Error creating invoice:", error);
    throw error;
  }
}
