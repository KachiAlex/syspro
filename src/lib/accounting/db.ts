import { db, sql as SQL, SqlClient } from "@/lib/sql-client";
import {
  ChartOfAccount,
  ChartOfAccountCreateInput,
  ChartOfAccountUpdateInput,
  FiscalPeriod,
  FiscalPeriodCreateInput,
  JournalEntry,
  JournalLine,
  JournalEntryCreateInput,
  AccountBalance,
  TrialBalance,
  GeneralLedgerEntry,
  AccountingAuditLog,
  PostingResult,
  TrialBalanceResponse,
  JOURNAL_TYPES,
} from "./types";

// using `db` imported from sql-client

/**
 * ACCOUNTING CORE DATABASE SERVICE
 * Double-entry bookkeeping operations with full audit trail
 */

// ============================================================
// CHART OF ACCOUNTS - CREATE, READ, UPDATE
// ============================================================

export async function createChartOfAccount(
  input: ChartOfAccountCreateInput
): Promise<ChartOfAccount> {
  try {
    const sql = SQL;
    
    const result = await sql`
      INSERT INTO chart_of_accounts (
        tenant_slug, account_code, account_name, account_type, sub_type,
        parent_account_id, description, currency, is_system_account, is_active,
        branch_id, department_id, project_id,
        allow_manual_posting, require_cost_center, is_reconciliation_account,
        created_by
      ) VALUES (
        ${input.tenantSlug}, ${input.accountCode}, ${input.accountName}, 
        ${input.accountType}, ${input.subType}, ${input.parentAccountId},
        ${input.description}, ${input.currency}, ${input.isSystemAccount},
        ${input.isActive}, ${input.branchId}, ${input.departmentId},
        ${input.projectId}, ${input.allowManualPosting}, ${input.requireCostCenter},
        ${input.isReconciliationAccount}, ${input.createdBy}
      )
      RETURNING *
    `;

    return Array.isArray(result) ? result[0] : result;
  } catch (error) {
    console.error("Error creating chart of account:", error);
    throw error;
  }
}

export async function getChartOfAccounts(
  tenantSlug: string,
  filters?: { accountType?: string; branchId?: string; isActive?: boolean }
): Promise<ChartOfAccount[]> {
  try {
    const sql = SQL;
    
    // Build dynamic query based on filters
    let whereConditions = ["tenant_slug = $1"];
    const params: any[] = [tenantSlug];
    let paramIndex = 2;

    if (filters?.accountType) {
      whereConditions.push(`account_type = $${paramIndex}`);
      params.push(filters.accountType);
      paramIndex++;
    }

    if (filters?.branchId) {
      whereConditions.push(`branch_id = $${paramIndex}`);
      params.push(filters.branchId);
      paramIndex++;
    }

    if (filters?.isActive !== undefined) {
      whereConditions.push(`is_active = $${paramIndex}`);
      params.push(filters.isActive);
      paramIndex++;
    }

    const whereClause = whereConditions.join(" AND ");
    
    // Use raw query with Neon
    const query = `SELECT * FROM chart_of_accounts WHERE ${whereClause} ORDER BY account_code`;
    
    // Execute with params - Neon supports this
    const result = await (sql as any)(query, params);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("Error fetching chart of accounts:", error);
    return [];
  }
}

export async function getChartOfAccount(
  accountId: string
): Promise<ChartOfAccount> {
  const result = await db.query<ChartOfAccount>(
    "SELECT * FROM chart_of_accounts WHERE id = $1",
    [accountId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Account ${accountId} not found`);
  }

  return result.rows[0];
}

export async function updateChartOfAccount(
  accountId: string,
  input: ChartOfAccountUpdateInput
): Promise<ChartOfAccount> {
  const account = await getChartOfAccount(accountId);

  if (account.isSystemAccount) {
    throw new Error("System accounts cannot be modified");
  }

  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (input.accountName) {
    updates.push(`account_name = $${paramIndex++}`);
    params.push(input.accountName);
  }

  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    params.push(input.description);
  }

  if (input.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    params.push(input.isActive);
  }

  if (input.allowManualPosting !== undefined) {
    updates.push(`allow_manual_posting = $${paramIndex++}`);
    params.push(input.allowManualPosting);
  }

  if (input.requireCostCenter !== undefined) {
    updates.push(`require_cost_center = $${paramIndex++}`);
    params.push(input.requireCostCenter);
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);

  params.push(accountId);

  const result = await db.query<ChartOfAccount>(
    `UPDATE chart_of_accounts SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  return result.rows[0];
}

// ============================================================
// FISCAL PERIODS - CREATE, READ, MANAGE
// ============================================================

export async function createFiscalPeriod(
  input: FiscalPeriodCreateInput
): Promise<FiscalPeriod> {
  const result = await db.query<FiscalPeriod>(
    `INSERT INTO fiscal_periods (
      tenant_slug, fiscal_year, period_number, period_name,
      start_date, end_date, status, allow_posting, allow_adjustments
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      input.tenantSlug,
      input.fiscalYear,
      input.periodNumber,
      input.periodName || `FY${input.fiscalYear}-P${input.periodNumber}`,
      input.startDate,
      input.endDate,
      input.status,
      input.allowPosting,
      input.allowAdjustments,
    ]
  );

  return result.rows[0];
}

export async function getFiscalPeriods(
  tenantSlug: string,
  filters?: { fiscalYear?: number; status?: string }
): Promise<FiscalPeriod[]> {
  let query = "SELECT * FROM fiscal_periods WHERE tenant_slug = $1";
  const params: any[] = [tenantSlug];

  if (filters?.fiscalYear) {
    query += ` AND fiscal_year = $${params.length + 1}`;
    params.push(filters.fiscalYear);
  }

  if (filters?.status) {
    query += ` AND status = $${params.length + 1}`;
    params.push(filters.status);
  }

  query += " ORDER BY fiscal_year DESC, period_number ASC";

  const result = await db.query<FiscalPeriod>(query, params);
  return result.rows;
}

export async function getFiscalPeriod(periodId: string): Promise<FiscalPeriod> {
  const result = await db.query<FiscalPeriod>(
    "SELECT * FROM fiscal_periods WHERE id = $1",
    [periodId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Fiscal period ${periodId} not found`);
  }

  return result.rows[0];
}

export async function getPeriodByDate(
  tenantSlug: string,
  date: Date
): Promise<FiscalPeriod> {
  const result = await db.query<FiscalPeriod>(
    `SELECT * FROM fiscal_periods
     WHERE tenant_slug = $1 AND start_date <= $2 AND end_date >= $2
     LIMIT 1`,
    [tenantSlug, date]
  );

  if (result.rows.length === 0) {
    throw new Error(`No fiscal period found for ${date}`);
  }

  return result.rows[0];
}

export async function lockFiscalPeriod(
  periodId: string,
  userId: string
): Promise<FiscalPeriod> {
  const result = await db.query<FiscalPeriod>(
    `UPDATE fiscal_periods SET status = 'LOCKED', locked_by = $1, locked_at = CURRENT_TIMESTAMP
     WHERE id = $2 RETURNING *`,
    [userId, periodId]
  );

  return result.rows[0];
}

export async function closeAllPeriodsUpto(
  tenantSlug: string,
  yearEnd: number
): Promise<void> {
  await db.query(
    `UPDATE fiscal_periods SET status = 'CLOSED'
     WHERE tenant_slug = $1 AND fiscal_year = $2`,
    [tenantSlug, yearEnd]
  );
}

// ============================================================
// JOURNAL ENTRIES - CREATE, POST, REVERSE
// ============================================================

export async function createJournalEntry(
  input: JournalEntryCreateInput
): Promise<{ entry: JournalEntry; lines: JournalLine[] }> {
  // Validate double-entry bookkeeping
  const totalDebit = input.lines.reduce((sum, line) => sum + line.debitAmount, 0);
  const totalCredit = input.lines.reduce(
    (sum, line) => sum + line.creditAmount,
    0
  );

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(
      `Double-entry bookkeeping violation: Debits (${totalDebit}) ≠ Credits (${totalCredit})`
    );
  }

  // Validate fiscal period
  const period = await getFiscalPeriod(input.fiscalPeriodId);
  if (!period.allowPosting) {
    throw new Error(
      `Cannot post to period ${period.periodName}: Period is closed or locked`
    );
  }

  // Generate journal number
  const journalNumber = await generateJournalNumber(
    input.tenantSlug,
    input.journalType
  );

  // Create journal entry
  const entryResult = await db.query<JournalEntry>(
    `INSERT INTO journal_entries (
      tenant_slug, journal_number, journal_type, fiscal_period_id,
      posting_date, reference_id, reference_type, total_debit, total_credit,
      description, notes, approval_status, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      input.tenantSlug,
      journalNumber,
      input.journalType,
      input.fiscalPeriodId,
      input.postingDate,
      input.referenceId,
      input.referenceType,
      totalDebit,
      totalCredit,
      input.description,
      input.notes,
      "DRAFT",
      input.createdBy,
    ]
  );

  const entry = entryResult.rows[0];

  // Create journal lines
  const lines: JournalLine[] = [];
  for (const lineInput of input.lines) {
    const lineResult = await db.query<JournalLine>(
      `INSERT INTO journal_lines (
        journal_entry_id, line_number, account_id,
        debit_amount, credit_amount, branch_id, department_id, project_id,
        cost_center_id, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        entry.id,
        lineInput.lineNumber,
        lineInput.accountId,
        lineInput.debitAmount,
        lineInput.creditAmount,
        lineInput.branchId,
        lineInput.departmentId,
        lineInput.projectId,
        lineInput.costCenterId,
        lineInput.description,
      ]
    );

    lines.push(lineResult.rows[0]);
  }

  // Log creation
  await logAuditTrail(
    input.tenantSlug,
    "JOURNAL_ENTRY",
    entry.id,
    "CREATE",
    { journalNumber, journalType: input.journalType },
    null,
    { journalNumber, journalType: input.journalType },
    input.createdBy
  );

  return { entry, lines };
}

export async function postJournalEntry(
  entryId: string,
  approverEmail: string,
  approverName: string
): Promise<JournalEntry> {
  const entry = await getJournalEntry(entryId);

  if (entry.approvalStatus === "POSTED") {
    throw new Error("Journal entry already posted");
  }

  // Update entry status
  const result = await db.query<JournalEntry>(
    `UPDATE journal_entries SET approval_status = 'POSTED', approved_by = $1, 
     approved_at = CURRENT_TIMESTAMP, posted_at = CURRENT_TIMESTAMP
     WHERE id = $2 RETURNING *`,
    [approverEmail, entryId]
  );

  const postedEntry = result.rows[0];

  // Update account balances
  const lines = await getJournalLines(entryId);
  for (const line of lines) {
    await updateAccountBalance(
      entry.tenantSlug,
      line.accountId,
      entry.fiscalPeriodId,
      line.debitAmount,
      line.creditAmount
    );
  }

  // Log posting
  await logAuditTrail(
    entry.tenantSlug,
    "JOURNAL_ENTRY",
    entryId,
    "POST",
    { status: "POSTED" },
    { status: entry.approvalStatus },
    { status: "POSTED" },
    approverEmail
  );

  return postedEntry;
}

export async function reverseJournalEntry(
  entryId: string,
  reason: string,
  userId: string
): Promise<JournalEntry> {
  const originalEntry = await getJournalEntry(entryId);

  if (originalEntry.isReversing) {
    throw new Error("Cannot reverse a reversing entry");
  }

  const period = await getFiscalPeriod(originalEntry.fiscalPeriodId);
  const lines = await getJournalLines(entryId);

  // Create reversing entry with opposite amounts
  const reversingInput: JournalEntryCreateInput = {
    tenantSlug: originalEntry.tenantSlug,
    journalType: "REVERSING",
    fiscalPeriodId: originalEntry.fiscalPeriodId,
    postingDate: new Date(),
    referenceId: originalEntry.id,
    referenceType: "REVERSAL_OF",
    description: `Reversal of ${originalEntry.journalNumber}`,
    notes: reason,
    createdBy: userId,
    lines: lines.map((line) => ({
      lineNumber: line.lineNumber,
      accountId: line.accountId,
      debitAmount: line.creditAmount, // Swap debit/credit
      creditAmount: line.debitAmount,
      branchId: line.branchId ?? undefined,
      departmentId: line.departmentId ?? undefined,
      projectId: line.projectId ?? undefined,
      costCenterId: line.costCenterId ?? undefined,
      description: `Reversal: ${line.description || ""}`,
    })),
  };

  const { entry: reversingEntry } = await createJournalEntry(reversingInput);

  // Link entries
  await db.query(
    `UPDATE journal_entries SET reversed_entry_id = $1, is_reversing = true
     WHERE id = $2`,
    [reversingEntry.id, entryId]
  );

  // Post reversing entry
  await postJournalEntry(reversingEntry.id, userId, "Automatic Reversal");

  return reversingEntry;
}

export async function getJournalEntry(entryId: string): Promise<JournalEntry> {
  const result = await db.query<JournalEntry>(
    "SELECT * FROM journal_entries WHERE id = $1",
    [entryId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Journal entry ${entryId} not found`);
  }

  return result.rows[0];
}

export async function getJournalLines(
  entryId: string
): Promise<JournalLine[]> {
  const result = await db.query<JournalLine>(
    "SELECT * FROM journal_lines WHERE journal_entry_id = $1 ORDER BY line_number",
    [entryId]
  );

  return result.rows;
}

export async function getJournalEntries(
  tenantSlug: string,
  filters?: {
    fiscalPeriodId?: string;
    approvalStatus?: string;
    journalType?: string;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<JournalEntry[]> {
  let query = "SELECT * FROM journal_entries WHERE tenant_slug = $1";
  const params: any[] = [tenantSlug];

  if (filters?.fiscalPeriodId) {
    query += ` AND fiscal_period_id = $${params.length + 1}`;
    params.push(filters.fiscalPeriodId);
  }

  if (filters?.approvalStatus) {
    query += ` AND approval_status = $${params.length + 1}`;
    params.push(filters.approvalStatus);
  }

  if (filters?.journalType) {
    query += ` AND journal_type = $${params.length + 1}`;
    params.push(filters.journalType);
  }

  if (filters?.startDate) {
    query += ` AND posting_date >= $${params.length + 1}`;
    params.push(filters.startDate);
  }

  if (filters?.endDate) {
    query += ` AND posting_date <= $${params.length + 1}`;
    params.push(filters.endDate);
  }

  query += " ORDER BY posting_date DESC, journal_number DESC";

  const result = await db.query<JournalEntry>(query, params);
  return result.rows;
}

// ============================================================
// ACCOUNT BALANCES - UPDATE AND QUERY
// ============================================================

async function updateAccountBalance(
  tenantSlug: string,
  accountId: string,
  periodId: string,
  debitAmount: number,
  creditAmount: number
): Promise<void> {
  // Upsert account balance
  await db.query(
    `INSERT INTO account_balances (tenant_slug, account_id, fiscal_period_id, period_debit, period_credit)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (account_id, fiscal_period_id) DO UPDATE SET
       period_debit = account_balances.period_debit + $4,
       period_credit = account_balances.period_credit + $5,
       last_updated = CURRENT_TIMESTAMP`,
    [tenantSlug, accountId, periodId, debitAmount, creditAmount]
  );
}

export async function getAccountBalance(
  accountId: string,
  periodId: string
): Promise<AccountBalance> {
  const result = await db.query<AccountBalance>(
    "SELECT * FROM account_balances WHERE account_id = $1 AND fiscal_period_id = $2",
    [accountId, periodId]
  );

  if (result.rows.length === 0) {
    throw new Error(`No balance found for account ${accountId} in period ${periodId}`);
  }

  return result.rows[0];
}

// ============================================================
// REPORTING - TRIAL BALANCE & GENERAL LEDGER
// ============================================================

export async function getTrialBalance(
  tenantSlug: string,
  periodId: string
): Promise<TrialBalanceResponse> {
  const period = await getFiscalPeriod(periodId);

  const result = await db.query<TrialBalance>(
    `SELECT
       coa.id as account_id,
       coa.account_code,
       coa.account_name,
       coa.account_type,
       COALESCE(ab.closing_balance, 0) as balance,
       CASE
         WHEN coa.account_type IN ('ASSET', 'EXPENSE') THEN
           CASE WHEN ab.closing_balance > 0 THEN ab.closing_balance ELSE 0 END
         ELSE
           CASE WHEN ab.closing_balance > 0 THEN ab.closing_balance ELSE 0 END
       END as debit_balance,
       CASE
         WHEN coa.account_type IN ('LIABILITY', 'EQUITY', 'INCOME') THEN
           CASE WHEN ab.closing_balance > 0 THEN ab.closing_balance ELSE 0 END
         ELSE
           CASE WHEN ab.closing_balance < 0 THEN ABS(ab.closing_balance) ELSE 0 END
       END as credit_balance
     FROM account_balances ab
     JOIN chart_of_accounts coa ON ab.account_id = coa.id
     WHERE ab.tenant_slug = $1 AND ab.fiscal_period_id = $2 AND coa.is_active = TRUE
     ORDER BY coa.account_code`,
    [tenantSlug, periodId]
  );

  const entries = result.rows;
  const totalDebits = entries.reduce((sum, e) => sum + e.debitBalance, 0);
  const totalCredits = entries.reduce((sum, e) => sum + e.creditBalance, 0);

  return {
    fiscalYear: period.fiscalYear,
    period: period.periodNumber,
    totalDebits,
    totalCredits,
    entries,
    isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
  };
}

export async function getGeneralLedger(
  tenantSlug: string,
  accountId: string,
  filters?: { startDate?: Date; endDate?: Date }
): Promise<GeneralLedgerEntry[]> {
  let query = `
    SELECT
      je.id as entry_id,
      je.journal_number,
      je.journal_type,
      je.posting_date,
      je.reference_id,
      coa.account_code,
      coa.account_name,
      coa.account_type,
      jl.debit_amount,
      jl.credit_amount,
      je.description,
      je.approval_status,
      je.created_by,
      je.created_at
    FROM journal_entries je
    JOIN journal_lines jl ON je.id = jl.journal_entry_id
    JOIN chart_of_accounts coa ON jl.account_id = coa.id
    WHERE je.tenant_slug = $1 AND jl.account_id = $2 AND je.approval_status = 'POSTED'
  `;

  const params: any[] = [tenantSlug, accountId];

  if (filters?.startDate) {
    query += ` AND je.posting_date >= $${params.length + 1}`;
    params.push(filters.startDate);
  }

  if (filters?.endDate) {
    query += ` AND je.posting_date <= $${params.length + 1}`;
    params.push(filters.endDate);
  }

  query += " ORDER BY je.posting_date, je.journal_number";

  const result = await db.query<GeneralLedgerEntry>(query, params);
  return result.rows;
}

// ============================================================
// AUDIT LOGGING
// ============================================================

export async function logAuditTrail(
  tenantSlug: string,
  entityType: string,
  entityId: string,
  action: string,
  changedFields: any,
  oldValues: any,
  newValues: any,
  userId: string,
  ipAddress?: string
): Promise<AccountingAuditLog> {
  const result = await db.query<AccountingAuditLog>(
    `INSERT INTO accounting_audit_log (
      tenant_slug, entity_type, entity_id, action,
      changed_fields, old_values, new_values, user_id, ip_address, timestamp
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
    RETURNING *`,
    [
      tenantSlug,
      entityType,
      entityId,
      action,
      JSON.stringify(changedFields),
      JSON.stringify(oldValues),
      JSON.stringify(newValues),
      userId,
      ipAddress,
    ]
  );

  return result.rows[0];
}

export async function getAuditTrail(
  entityType: string,
  entityId: string
): Promise<AccountingAuditLog[]> {
  const result = await db.query<AccountingAuditLog>(
    "SELECT * FROM accounting_audit_log WHERE entity_type = $1 AND entity_id = $2 ORDER BY timestamp DESC",
    [entityType, entityId]
  );

  return result.rows;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function generateJournalNumber(
  tenantSlug: string,
  journalType: string
): Promise<string> {
  const prefix = journalType.substring(0, 3); // MAN, SYS, ADJ, REV
  const count = await db.query<{ count: string }>(
    "SELECT COUNT(*) as count FROM journal_entries WHERE tenant_slug = $1 AND journal_type = $2",
    [tenantSlug, journalType]
  );

  const nextNum = parseInt(count.rows[0]?.count || "0") + 1;
  return `${prefix}-${Date.now()}-${String(nextNum).padStart(6, "0")}`;
}

export async function initializeDefaultChartOfAccounts(
  tenantSlug: string,
  createdBy: string
): Promise<void> {
  const defaultAccounts = [
    // Assets
    { code: "1000", name: "Cash", type: "ASSET", system: true },
    { code: "1100", name: "Accounts Receivable", type: "ASSET", system: true },
    { code: "1200", name: "Inventory", type: "ASSET", system: true },
    { code: "1500", name: "Fixed Assets", type: "ASSET", system: true },

    // Liabilities
    { code: "2000", name: "Accounts Payable", type: "LIABILITY", system: true },
    { code: "2100", name: "Sales Tax Payable", type: "LIABILITY", system: true },
    { code: "2200", name: "Salaries Payable", type: "LIABILITY", system: true },

    // Equity
    { code: "3000", name: "Owner Capital", type: "EQUITY", system: true },
    { code: "3100", name: "Retained Earnings", type: "EQUITY", system: true },

    // Income
    { code: "4000", name: "Sales Revenue", type: "INCOME", system: true },
    { code: "4100", name: "Service Revenue", type: "INCOME", system: true },

    // Expenses
    { code: "5000", name: "Cost of Goods Sold", type: "EXPENSE", system: true },
    { code: "5100", name: "Salaries Expense", type: "EXPENSE", system: true },
    { code: "5200", name: "Rent Expense", type: "EXPENSE", system: true },
    { code: "5300", name: "Utilities Expense", type: "EXPENSE", system: true },
  ];

  for (const acc of defaultAccounts) {
    await createChartOfAccount({
      tenantSlug,
      accountCode: acc.code,
      accountName: acc.name,
      accountType: acc.type as any,
      currency: "NGN",
      isSystemAccount: acc.system,
      isActive: true,
      allowManualPosting: true,
      requireCostCenter: false,
      isReconciliationAccount: false,
      createdBy,
    });
  }
}
