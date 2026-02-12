import { db } from "@/lib/sql-client";
import {
  Budget,
  BudgetLine,
  BudgetActual,
  BudgetForecast,
  BudgetVariance,
  BudgetVersion,
  BudgetApproval,
  BudgetSummary,
  BudgetLineVariance,
  BudgetCreateInput,
  BudgetUpdateInput,
  BudgetApproveInput,
  BudgetForecastCreateInput,
  BudgetStatus,
  BUDGET_STATUSES,
} from "./budgets";

/**
 * BUDGET CRUD OPERATIONS
 */

export async function createBudget(input: BudgetCreateInput): Promise<Budget | null> {
  try {
    const { budgetLines, ...budgetData } = input;

    const result = await db.query(
      `
      INSERT INTO budgets (
        tenant_id, code, name, description, budget_type, scope_entity_id, scope_entity_name,
        period_type, fiscal_year, quarter_num, month_num, total_budget_amount,
        status, enforcement_mode, allow_overrun, overrun_threshold_percent, version_number,
        created_by, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 1, $17, $18)
      RETURNING *
      `,
      [
        budgetData.tenantId.toString(),
        budgetData.code,
        budgetData.name,
        budgetData.description || null,
        budgetData.budgetType,
        budgetData.scopeEntityId?.toString() || null,
        budgetData.scopeEntityName || null,
        budgetData.periodType,
        budgetData.fiscalYear,
        budgetData.quarterNum || null,
        budgetData.monthNum || null,
        budgetData.totalBudgetAmount,
        "DRAFT",
        budgetData.enforcementMode,
        budgetData.allowOverrun || false,
        budgetData.overrunThresholdPercent || 110,
        "system",
        budgetData.notes || null,
      ]
    );

    const budget = db.mapRow(result.rows[0]);

    // Create budget lines
    if (budgetLines && budgetLines.length > 0) {
      for (const line of budgetLines) {
        await createBudgetLine(BigInt(budget.id), input.tenantId, line);
      }
    }

    // Create initial version
    await createBudgetVersion(
      BigInt(budget.id),
      input.tenantId,
      1,
      "DRAFT",
      budgetData.totalBudgetAmount,
      "Budget created",
      "system",
      budget
    );

    return getBudget(BigInt(budget.id), input.tenantId);
  } catch (error) {
    console.error("Error creating budget:", error);
    throw error;
  }
}

export async function getBudget(budgetId: bigint, tenantId: bigint): Promise<Budget | null> {
  try {
    const result = await db.query(
      `SELECT * FROM budgets WHERE id = $1 AND tenant_id = $2`,
      [budgetId.toString(), tenantId.toString()]
    );
    return db.mapRow(result.rows[0]) || null;
  } catch (error) {
    console.error("Error getting budget:", error);
    throw error;
  }
}

export async function getBudgets(tenantId: bigint, filters?: {
  status?: BudgetStatus;
  budgetType?: string;
  fiscalYear?: number;
}): Promise<Budget[]> {
  try {
    let query = "SELECT * FROM budgets WHERE tenant_id = $1";
    const params: any[] = [tenantId.toString()];

    if (filters?.status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(filters.status);
    }
    if (filters?.budgetType) {
      query += ` AND budget_type = $${params.length + 1}`;
      params.push(filters.budgetType);
    }
    if (filters?.fiscalYear) {
      query += ` AND fiscal_year = $${params.length + 1}`;
      params.push(filters.fiscalYear);
    }

    query += " ORDER BY created_at DESC";

    const result = await db.query(query, params);
    return db.mapRows(result.rows);
  } catch (error) {
    console.error("Error getting budgets:", error);
    throw error;
  }
}

export async function getBudgetSummaries(tenantId: bigint): Promise<BudgetSummary[]> {
  try {
    const result = await db.query(
      `SELECT * FROM budget_summary_view WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId.toString()]
    );
    return db.mapRows(result.rows);
  } catch (error) {
    console.error("Error getting budget summaries:", error);
    throw error;
  }
}

export async function updateBudget(
  budgetId: bigint,
  tenantId: bigint,
  input: BudgetUpdateInput
): Promise<Budget | null> {
  try {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name) {
      updates.push(`name = $${paramIndex++}`);
      params.push(input.name);
    }
    if (input.description) {
      updates.push(`description = $${paramIndex++}`);
      params.push(input.description);
    }
    if (input.totalBudgetAmount) {
      updates.push(`total_budget_amount = $${paramIndex++}`);
      params.push(input.totalBudgetAmount);
    }
    if (input.enforcementMode) {
      updates.push(`enforcement_mode = $${paramIndex++}`);
      params.push(input.enforcementMode);
    }
    if (input.allowOverrun !== undefined) {
      updates.push(`allow_overrun = $${paramIndex++}`);
      params.push(input.allowOverrun);
    }
    if (input.overrunThresholdPercent) {
      updates.push(`overrun_threshold_percent = $${paramIndex++}`);
      params.push(input.overrunThresholdPercent);
    }
    if (input.notes) {
      updates.push(`notes = $${paramIndex++}`);
      params.push(input.notes);
    }

    updates.push(`version_number = version_number + 1`);

    if (updates.length === 1) return getBudget(budgetId, tenantId); // No updates

    params.push(budgetId.toString());
    params.push(tenantId.toString());

    const result = await db.query(
      `UPDATE budgets SET ${updates.join(", ")} WHERE id = $${paramIndex + 1} AND tenant_id = $${paramIndex + 2} RETURNING *`,
      params
    );

    const budget = db.mapRow(result.rows[0]);

    // Create version record
    if (input.changeReason) {
      await createBudgetVersion(
        budgetId,
        tenantId,
        budget.versionNumber,
        budget.status,
        budget.totalBudgetAmount,
        input.changeReason,
        "system",
        budget
      );
    }

    return budget;
  } catch (error) {
    console.error("Error updating budget:", error);
    throw error;
  }
}

export async function changeBudgetStatus(
  budgetId: bigint,
  tenantId: bigint,
  newStatus: BudgetStatus
): Promise<Budget | null> {
  try {
    const result = await db.query(
      `UPDATE budgets SET status = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [newStatus, budgetId.toString(), tenantId.toString()]
    );

    const budget = db.mapRow(result.rows[0]);

    await createBudgetVersion(
      budgetId,
      tenantId,
      budget.versionNumber,
      newStatus,
      budget.totalBudgetAmount,
      `Status changed to ${newStatus}`,
      "system",
      budget
    );

    return budget;
  } catch (error) {
    console.error("Error changing budget status:", error);
    throw error;
  }
}

export async function deleteBudget(budgetId: bigint, tenantId: bigint): Promise<boolean> {
  try {
    const result = await db.query(
      `DELETE FROM budgets WHERE id = $1 AND tenant_id = $2`,
      [budgetId.toString(), tenantId.toString()]
    );
    return result.rowCount > 0;
  } catch (error) {
    console.error("Error deleting budget:", error);
    throw error;
  }
}

/**
 * BUDGET LINE OPERATIONS
 */

export async function createBudgetLine(
  budgetId: bigint,
  tenantId: bigint,
  line: any
): Promise<BudgetLine | null> {
  try {
    const result = await db.query(
      `
      INSERT INTO budget_lines (
        budget_id, tenant_id, line_number, account_id, account_code, account_name,
        cost_center_id, cost_center_name, project_id, project_name,
        budgeted_amount, allocation_percent, description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
      `,
      [
        budgetId.toString(),
        tenantId.toString(),
        line.lineNumber,
        line.accountId?.toString() || null,
        line.accountCode || null,
        line.accountName || null,
        line.costCenterId?.toString() || null,
        line.costCenterName || null,
        line.projectId?.toString() || null,
        line.projectName || null,
        line.budgetedAmount,
        line.allocationPercent || null,
        line.description || null,
      ]
    );

    return db.mapRow(result.rows[0]);
  } catch (error) {
    console.error("Error creating budget line:", error);
    throw error;
  }
}

export async function getBudgetLines(budgetId: bigint, tenantId: bigint): Promise<BudgetLine[]> {
  try {
    const result = await db.query(
      `SELECT * FROM budget_lines WHERE budget_id = $1 AND tenant_id = $2 ORDER BY line_number`,
      [budgetId.toString(), tenantId.toString()]
    );
    return db.mapRows(result.rows);
  } catch (error) {
    console.error("Error getting budget lines:", error);
    throw error;
  }
}

export async function getBudgetLineVariances(budgetId: bigint): Promise<BudgetLineVariance[]> {
  try {
    const result = await db.query(
      `SELECT * FROM budget_line_variance_view WHERE budget_id = $1`,
      [budgetId.toString()]
    );
    return db.mapRows(result.rows);
  } catch (error) {
    console.error("Error getting budget line variances:", error);
    throw error;
  }
}

export async function updateBudgetLine(
  budgetLineId: bigint,
  tenantId: bigint,
  updates: any
): Promise<BudgetLine | null> {
  try {
    const updateClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.accountId) {
      updateClauses.push(`account_id = $${paramIndex++}`);
      params.push(updates.accountId.toString());
    }
    if (updates.budgetedAmount !== undefined) {
      updateClauses.push(`budgeted_amount = $${paramIndex++}`);
      params.push(updates.budgetedAmount);
    }
    if (updates.description) {
      updateClauses.push(`description = $${paramIndex++}`);
      params.push(updates.description);
    }

    if (updateClauses.length === 0) return null;

    updateClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(budgetLineId.toString());
    params.push(tenantId.toString());

    const result = await db.query(
      `UPDATE budget_lines SET ${updateClauses.join(", ")} WHERE id = $${paramIndex + 1} AND tenant_id = $${paramIndex + 2} RETURNING *`,
      params
    );

    return db.mapRow(result.rows[0]) || null;
  } catch (error) {
    console.error("Error updating budget line:", error);
    throw error;
  }
}

export async function deleteBudgetLine(budgetLineId: bigint, tenantId: bigint): Promise<boolean> {
  try {
    const result = await db.query(
      `DELETE FROM budget_lines WHERE id = $1 AND tenant_id = $2`,
      [budgetLineId.toString(), tenantId.toString()]
    );
    return result.rowCount > 0;
  } catch (error) {
    console.error("Error deleting budget line:", error);
    throw error;
  }
}

export async function createBudgetVersion(
  budgetId: bigint,
  tenantId: bigint,
  versionNumber: number,
  status: BudgetStatus,
  totalBudgetAmount: number,
  changeReason: string,
  changedBy: string,
  budgetSnapshot?: any
): Promise<void> {
  try {
    const id = Date.now().toString();
    await db.query(
      `INSERT INTO budget_versions (id, budget_id, tenant_id, version_number, status, total_budget_amount, change_reason, changed_by, budget_snapshot, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW())`,
      [
        id,
        budgetId.toString(),
        tenantId.toString(),
        versionNumber,
        status,
        totalBudgetAmount,
        changeReason || null,
        changedBy,
        JSON.stringify(budgetSnapshot || {}),
      ]
    );
  } catch (err) {
    // If migrations not applied, don't fail type-checking or seed flows
    console.warn("createBudgetVersion skipped (table may be missing):", err?.message || err);
  }
}

/** End of file */
