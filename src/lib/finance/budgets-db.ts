import { getSql } from "@/lib/db";

const db = getSql();
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

    const budget = result.rows[0];

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
    return result.rows[0] || null;
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
    return result.rows;
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
    return result.rows;
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

    const budget = result.rows[0];

    // Create version record
    if (input.changeReason) {
      await createBudgetVersion(
        budgetId,
        tenantId,
        budget.version_number,
        budget.status,
        budget.total_budget_amount,
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

    const budget = result.rows[0];

    await createBudgetVersion(
      budgetId,
      tenantId,
      budget.version_number,
      newStatus,
      budget.total_budget_amount,
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

    return result.rows[0];
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
    return result.rows;
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
    return result.rows;
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

    return result.rows[0] || null;
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

/**
 * BUDGET VERSION OPERATIONS
 */

export async function createBudgetVersion(
  budgetId: bigint,
  tenantId: bigint,
  versionNumber: number,
  status: BudgetStatus,
  totalAmount: number,
  changeReason: string,
  changedBy: string,
  budgetSnapshot: any
): Promise<BudgetVersion | null> {
  try {
    const result = await db.query(
      `
      INSERT INTO budget_versions (
        budget_id, tenant_id, version_number, status, total_budget_amount,
        change_reason, changed_by, budget_snapshot
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [
        budgetId.toString(),
        tenantId.toString(),
        versionNumber,
        status,
        totalAmount,
        changeReason,
        changedBy,
        JSON.stringify(budgetSnapshot),
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error creating budget version:", error);
    throw error;
  }
}

export async function getBudgetVersions(budgetId: bigint, tenantId: bigint): Promise<BudgetVersion[]> {
  try {
    const result = await db.query(
      `SELECT * FROM budget_versions WHERE budget_id = $1 AND tenant_id = $2 ORDER BY version_number DESC`,
      [budgetId.toString(), tenantId.toString()]
    );
    return result.rows;
  } catch (error) {
    console.error("Error getting budget versions:", error);
    throw error;
  }
}

/**
 * BUDGET ACTUALS OPERATIONS
 */

export async function recordBudgetActual(
  budgetId: bigint,
  tenantId: bigint,
  actual: any
): Promise<BudgetActual | null> {
  try {
    const result = await db.query(
      `
      INSERT INTO budget_actuals (
        budget_id, budget_line_id, tenant_id, actual_type, transaction_id, transaction_code,
        actual_amount, committed_amount, account_id, account_code, cost_center_id, project_id,
        transaction_date, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
      `,
      [
        budgetId.toString(),
        actual.budgetLineId?.toString() || null,
        tenantId.toString(),
        actual.actualType,
        actual.transactionId?.toString() || null,
        actual.transactionCode || null,
        actual.actualAmount,
        actual.committedAmount || 0,
        actual.accountId?.toString() || null,
        actual.accountCode || null,
        actual.costCenterId?.toString() || null,
        actual.projectId?.toString() || null,
        actual.transactionDate || null,
        actual.notes || null,
      ]
    );

    // Check for variances
    await checkAndCreateVariances(budgetId, tenantId);

    return result.rows[0];
  } catch (error) {
    console.error("Error recording budget actual:", error);
    throw error;
  }
}

export async function getBudgetActuals(
  budgetId: bigint,
  tenantId: bigint,
  filters?: {
    actualType?: string;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<BudgetActual[]> {
  try {
    let query = "SELECT * FROM budget_actuals WHERE budget_id = $1 AND tenant_id = $2";
    const params: any[] = [budgetId.toString(), tenantId.toString()];

    if (filters?.actualType) {
      query += ` AND actual_type = $${params.length + 1}`;
      params.push(filters.actualType);
    }
    if (filters?.startDate) {
      query += ` AND transaction_date >= $${params.length + 1}`;
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      query += ` AND transaction_date <= $${params.length + 1}`;
      params.push(filters.endDate);
    }

    query += " ORDER BY transaction_date DESC";

    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    console.error("Error getting budget actuals:", error);
    throw error;
  }
}

export async function getTotalActualsByBudgetLine(
  budgetLineId: bigint
): Promise<{ actual: number; committed: number } | null> {
  try {
    const result = await db.query(
      `
      SELECT
        COALESCE(SUM(actual_amount), 0) as actual,
        COALESCE(SUM(committed_amount), 0) as committed
      FROM budget_actuals
      WHERE budget_line_id = $1
      `,
      [budgetLineId.toString()]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error("Error getting actuals total:", error);
    throw error;
  }
}

/**
 * VARIANCE DETECTION AND REPORTING
 */

export async function checkAndCreateVariances(
  budgetId: bigint,
  tenantId: bigint
): Promise<BudgetVariance[]> {
  try {
    const budget = await getBudget(budgetId, tenantId);
    if (!budget) return [];

    const lines = await getBudgetLines(budgetId, tenantId);
    const variances: BudgetVariance[] = [];

    for (const line of lines) {
      const actuals = await getTotalActualsByBudgetLine(BigInt(line.id));
      if (!actuals) continue;

      const totalSpent = actuals.actual + actuals.committed;
      const variance = line.budgeted_amount - totalSpent;
      const variancePercent = (totalSpent / line.budgeted_amount) * 100;

      let varianceType = "UNDER_BUDGET";
      let alertLevel = "INFO";

      if (totalSpent > line.budgeted_amount) {
        varianceType = "OVER_BUDGET";
        alertLevel = variancePercent > 110 ? "CRITICAL" : "WARNING";
      } else if (variancePercent > 80) {
        varianceType = "THRESHOLD_WARNING";
        alertLevel = "WARNING";
      }

      // Check if variance already exists and update or create
      const existingVariance = await db.query(
        `SELECT id FROM budget_variances WHERE budget_line_id = $1 AND variance_type = $2 LIMIT 1`,
        [BigInt(line.id).toString(), varianceType]
      );

      if (existingVariance.rows.length > 0) {
        // Update existing variance
        await db.query(
          `
          UPDATE budget_variances
          SET actual_amount = $1, committed_amount = $2, variance_amount = $3, variance_percent = $4, alert_level = $5, updated_at = CURRENT_TIMESTAMP
          WHERE id = $6
          `,
          [
            actuals.actual,
            actuals.committed,
            variance,
            Math.round(variancePercent * 100) / 100,
            alertLevel,
            existingVariance.rows[0].id,
          ]
        );
      } else {
        // Create new variance
        const result = await db.query(
          `
          INSERT INTO budget_variances (
            budget_id, budget_line_id, tenant_id, variance_type, budgeted_amount,
            actual_amount, committed_amount, variance_amount, variance_percent, alert_level
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
          `,
          [
            budgetId.toString(),
            BigInt(line.id).toString(),
            tenantId.toString(),
            varianceType,
            line.budgeted_amount,
            actuals.actual,
            actuals.committed,
            variance,
            Math.round(variancePercent * 100) / 100,
            alertLevel,
          ]
        );

        variances.push(result.rows[0]);
      }
    }

    return variances;
  } catch (error) {
    console.error("Error checking variances:", error);
    throw error;
  }
}

export async function getBudgetVariances(
  budgetId: bigint,
  tenantId: bigint,
  filters?: {
    varianceType?: string;
    alertLevel?: string;
  }
): Promise<BudgetVariance[]> {
  try {
    let query = "SELECT * FROM budget_variances WHERE budget_id = $1 AND tenant_id = $2";
    const params: any[] = [budgetId.toString(), tenantId.toString()];

    if (filters?.varianceType) {
      query += ` AND variance_type = $${params.length + 1}`;
      params.push(filters.varianceType);
    }
    if (filters?.alertLevel) {
      query += ` AND alert_level = $${params.length + 1}`;
      params.push(filters.alertLevel);
    }

    query += " ORDER BY updated_at DESC";

    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    console.error("Error getting budget variances:", error);
    throw error;
  }
}

export async function acknowledgeBudgetVariance(
  varianceId: bigint,
  acknowledgedBy: string
): Promise<BudgetVariance | null> {
  try {
    const result = await db.query(
      `
      UPDATE budget_variances
      SET is_acknowledged = true, acknowledged_by = $1, acknowledged_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
      `,
      [acknowledgedBy, varianceId.toString()]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error("Error acknowledging variance:", error);
    throw error;
  }
}

/**
 * FORECASTING OPERATIONS
 */

export async function createBudgetForecast(
  input: BudgetForecastCreateInput
): Promise<BudgetForecast | null> {
  try {
    const result = await db.query(
      `
      INSERT INTO budget_forecasts (
        budget_id, tenant_id, forecast_type, forecast_period_start, forecast_period_end,
        forecast_lines, scenario_name, scenario_description, methodology, base_periods,
        confidence_level, variance_percent, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'system')
      RETURNING *
      `,
      [
        input.budgetId.toString(),
        input.tenantId.toString(),
        input.forecastType,
        input.forecastPeriodStart || null,
        input.forecastPeriodEnd || null,
        JSON.stringify(input.forecastLines),
        input.scenarioName || null,
        input.scenarioDescription || null,
        input.methodology || null,
        input.basePeriods || null,
        input.confidenceLevel || null,
        input.variancePercent || null,
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error creating budget forecast:", error);
    throw error;
  }
}

export async function getBudgetForecasts(
  budgetId: bigint,
  tenantId: bigint,
  forecastType?: string
): Promise<BudgetForecast[]> {
  try {
    let query = "SELECT * FROM budget_forecasts WHERE budget_id = $1 AND tenant_id = $2";
    const params: any[] = [budgetId.toString(), tenantId.toString()];

    if (forecastType) {
      query += ` AND forecast_type = $${params.length + 1}`;
      params.push(forecastType);
    }

    query += " ORDER BY created_at DESC";

    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    console.error("Error getting budget forecasts:", error);
    throw error;
  }
}

export async function generateRollingForecast(
  budgetId: bigint,
  tenantId: bigint,
  basePeriods: number = 3
): Promise<BudgetForecast | null> {
  try {
    const lines = await getBudgetLines(budgetId, tenantId);
    const forecastLines = [];

    for (const line of lines) {
      // Calculate average of last N periods (simplified)
      const actuals = await getBudgetActuals(budgetId, tenantId, {
        actualType: "EXPENSE",
      });

      const lineActuals = actuals.filter(
        (a) => a.budget_line_id === BigInt(line.id)
      );

      if (lineActuals.length > 0) {
        const avgAmount =
          lineActuals.reduce((sum, a) => sum + a.actual_amount, 0) / lineActuals.length;

        forecastLines.push({
          budgetLineId: BigInt(line.id),
          forecastedAmount: avgAmount,
          confidenceLevel: "MEDIUM",
        });
      }
    }

    return await createBudgetForecast({
      budgetId,
      tenantId,
      forecastType: "ROLLING",
      forecastLines,
      methodology: "avg_of_last_n_periods",
      basePeriods,
      confidenceLevel: "MEDIUM",
    });
  } catch (error) {
    console.error("Error generating rolling forecast:", error);
    throw error;
  }
}

/**
 * APPROVAL WORKFLOW
 */

export async function createBudgetApproval(
  budgetId: bigint,
  tenantId: bigint,
  sequence: number,
  approverRole: string
): Promise<BudgetApproval | null> {
  try {
    const result = await db.query(
      `
      INSERT INTO budget_approvals (budget_id, tenant_id, approval_sequence, approver_role, status)
      VALUES ($1, $2, $3, $4, 'PENDING')
      RETURNING *
      `,
      [budgetId.toString(), tenantId.toString(), sequence, approverRole]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error creating budget approval:", error);
    throw error;
  }
}

export async function approveBudget(
  input: BudgetApproveInput
): Promise<BudgetApproval | null> {
  try {
    const result = await db.query(
      `
      UPDATE budget_approvals
      SET status = $1, approver_id = $2, approver_name = $3, comment = $4, approved_at = CURRENT_TIMESTAMP
      WHERE budget_id = $5 AND tenant_id = $6 AND approval_sequence = 1
      RETURNING *
      `,
      [
        input.approve ? "APPROVED" : "REJECTED",
        input.approverId,
        input.approverName,
        input.comment || null,
        input.budgetId.toString(),
        input.tenantId.toString(),
      ]
    );

    if (result.rows[0] && input.approve) {
      // Change budget status to APPROVED
      await changeBudgetStatus(input.budgetId, input.tenantId, "APPROVED");
    }

    return result.rows[0] || null;
  } catch (error) {
    console.error("Error approving budget:", error);
    throw error;
  }
}

export async function getBudgetApprovals(
  budgetId: bigint,
  tenantId: bigint
): Promise<BudgetApproval[]> {
  try {
    const result = await db.query(
      `SELECT * FROM budget_approvals WHERE budget_id = $1 AND tenant_id = $2 ORDER BY approval_sequence`,
      [budgetId.toString(), tenantId.toString()]
    );
    return result.rows;
  } catch (error) {
    console.error("Error getting budget approvals:", error);
    throw error;
  }
}

/**
 * ENFORCEMENT CHECK - Used before posting expenses/POs
 */

export async function checkBudgetEnforcement(
  budgetId: bigint,
  budgetLineId: bigint | null,
  proposedAmount: number
): Promise<{
  canProceed: boolean;
  remainingBalance: number;
  enforcementMode: string;
  message: string;
} | null> {
  try {
    const budget = await getBudget(budgetId, BigInt(0)); // Simplified - need tenant context
    if (!budget) {
      return null;
    }

    let remainingBalance = 0;

    if (budgetLineId) {
      // Check line-level budget
      const actuals = await getTotalActualsByBudgetLine(budgetLineId);
      const line = await getBudgetLineVariances(budgetId);
      const lineData = line.find((l) => l.budgetLineId === budgetLineId);

      if (lineData) {
        remainingBalance = lineData.remainingBalance;
      }
    }

    const wouldExceed = remainingBalance < proposedAmount;

    if (wouldExceed && budget.enforcement_mode === "HARD_BLOCK" && !budget.allow_overrun) {
      return {
        canProceed: false,
        remainingBalance,
        enforcementMode: budget.enforcement_mode,
        message: `Budget exceeded. Remaining: $${remainingBalance}, Proposed: $${proposedAmount}`,
      };
    }

    return {
      canProceed: true,
      remainingBalance,
      enforcementMode: budget.enforcement_mode,
      message: wouldExceed ? "Budget threshold exceeded - Warning" : "Budget check passed",
    };
  } catch (error) {
    console.error("Error checking budget enforcement:", error);
    throw error;
  }
}
