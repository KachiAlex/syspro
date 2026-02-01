/**
 * Expense API Client
 * Handles all API calls to the backend expenses endpoints
 */

export interface ExpenseListParams {
  tenantSlug?: string;
  approvalStatus?: string;
  paymentStatus?: string;
  categoryId?: string;
  createdBy?: string;
  limit?: number;
  offset?: number;
}

export interface ExpenseCreateInput {
  tenantSlug: string;
  regionId: string;
  branchId: string;
  type: "vendor" | "reimbursement" | "cash" | "prepaid";
  amount: number;
  taxType: "VAT" | "WHT" | "NONE";
  categoryId: string;
  description: string;
  vendor?: string;
  date: string;
  approvalStatus?: string;
  paymentStatus?: string;
  glAccountId?: string;
  notes?: string;
  attachments?: string[];
  createdBy: string;
}

export interface ExpenseUpdateInput {
  id: string;
  tenantSlug: string;
  amount?: number;
  taxType?: string;
  categoryId?: string;
  description?: string;
  vendor?: string;
  date?: string;
  approvalStatus?: string;
  paymentStatus?: string;
  notes?: string;
}

export interface ExpenseApprovalInput {
  expenseId: string;
  tenantSlug: string;
  approverRole: "MANAGER" | "FINANCE" | "EXECUTIVE";
  approverId: string;
  approverName: string;
  action: "approved" | "rejected" | "clarification_requested";
  reason?: string;
}

export interface ReportParams {
  tenantSlug?: string;
  type: "summary" | "by-category" | "aged" | "tax-summary";
  startDate?: string;
  endDate?: string;
}

/**
 * List all expenses with optional filters
 */
export async function listExpenses(params?: ExpenseListParams) {
  try {
    const queryParams = new URLSearchParams();
    if (params?.tenantSlug) queryParams.append("tenantSlug", params.tenantSlug);
    if (params?.approvalStatus) queryParams.append("approvalStatus", params.approvalStatus);
    if (params?.paymentStatus) queryParams.append("paymentStatus", params.paymentStatus);
    if (params?.categoryId) queryParams.append("categoryId", params.categoryId);
    if (params?.createdBy) queryParams.append("createdBy", params.createdBy);
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.offset) queryParams.append("offset", params.offset.toString());

    const query = queryParams.toString();
    const url = `/api/finance/expenses${query ? `?${query}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to list expenses: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error listing expenses:", error);
    throw error;
  }
}

/**
 * Get a single expense by ID
 */
export async function getExpense(id: string, tenantSlug: string) {
  try {
    const response = await fetch(`/api/finance/expenses/${id}?tenantSlug=${tenantSlug}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch expense: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching expense:", error);
    throw error;
  }
}

/**
 * Create a new expense
 */
export async function createExpense(input: ExpenseCreateInput) {
  try {
    const response = await fetch("/api/finance/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create expense");
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating expense:", error);
    throw error;
  }
}

/**
 * Update an existing expense
 */
export async function updateExpense(input: ExpenseUpdateInput) {
  try {
    const response = await fetch("/api/finance/expenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update expense");
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating expense:", error);
    throw error;
  }
}

/**
 * Delete an expense
 */
export async function deleteExpense(id: string, tenantSlug: string) {
  try {
    const response = await fetch("/api/finance/expenses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, tenantSlug }),
    });

    if (!response.ok) {
      throw new Error("Failed to delete expense");
    }

    return await response.json();
  } catch (error) {
    console.error("Error deleting expense:", error);
    throw error;
  }
}

/**
 * Approve/reject an expense
 */
export async function approveExpense(input: ExpenseApprovalInput) {
  try {
    const response = await fetch(
      `/api/finance/expenses/${input.expenseId}/approve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to approve expense");
    }

    return await response.json();
  } catch (error) {
    console.error("Error approving expense:", error);
    throw error;
  }
}

/**
 * Generate expense reports
 */
export async function generateReport(params: ReportParams) {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append("type", params.type);
    if (params.tenantSlug) queryParams.append("tenantSlug", params.tenantSlug);
    if (params.startDate) queryParams.append("startDate", params.startDate);
    if (params.endDate) queryParams.append("endDate", params.endDate);

    const response = await fetch(
      `/api/finance/expenses/reports?${queryParams.toString()}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to generate report");
    }

    return await response.json();
  } catch (error) {
    console.error("Error generating report:", error);
    throw error;
  }
}
