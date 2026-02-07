import { getSql } from "@/lib/db";

const db = getSql();
import {
  Asset,
  AssetCategory,
  DepreciationSchedule,
  AssetJournal,
  AssetDisposal,
  DepreciationMethod,
  AssetStatus,
  AssetRegisterSummary,
  DepreciationSummary,
  AssetCreateInput,
  AssetUpdateInput,
  DepreciationScheduleCreateInput,
  AssetDisposalCreateInput,
  assetCreateSchema,
  assetUpdateSchema,
  assetDisposalCreateSchema,
  assetCategoryCreateSchema,
} from "./assets-reports";

/**
 * ASSET CATEGORY OPERATIONS
 */

export async function createAssetCategory(
  input: any
): Promise<AssetCategory | null> {
  try {
    const validated = assetCategoryCreateSchema.parse(input);

    const result = await db.query(
      `
      INSERT INTO asset_categories (
        tenant_id, code, name, description, default_useful_life_years,
        default_depreciation_method, default_residual_percent,
        asset_account_id, accumulated_depreciation_account_id,
        depreciation_expense_account_id, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
      RETURNING *
      `,
      [
        validated.tenantId.toString(),
        validated.code,
        validated.name,
        validated.description || null,
        validated.defaultUsefulLifeYears || 5,
        validated.defaultDepreciationMethod,
        validated.defaultResidualPercent || 0,
        validated.assetAccountId?.toString() || null,
        validated.accumulatedDepreciationAccountId?.toString() || null,
        validated.depreciationExpenseAccountId?.toString() || null,
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error creating asset category:", error);
    throw error;
  }
}

export async function getAssetCategories(
  tenantId: bigint
): Promise<AssetCategory[]> {
  try {
    const result = await db.query(
      `SELECT * FROM asset_categories WHERE tenant_id = $1 AND is_active = true ORDER BY name`,
      [tenantId.toString()]
    );
    return result.rows;
  } catch (error) {
    console.error("Error getting asset categories:", error);
    throw error;
  }
}

/**
 * ASSET OPERATIONS
 */

export async function createAsset(input: AssetCreateInput): Promise<Asset | null> {
  try {
    const validated = assetCreateSchema.parse(input);

    const result = await db.query(
      `
      INSERT INTO assets (
        tenant_id, code, name, description, category_id, location, cost_center_id,
        purchase_date, purchase_cost, purchase_invoice_id, useful_life_years,
        depreciation_method, residual_value, accumulated_depreciation,
        net_book_value, asset_status, depreciation_started_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, $9, 'ACQUIRED', CURRENT_DATE)
      RETURNING *
      `,
      [
        validated.tenantId.toString(),
        validated.code,
        validated.name,
        validated.description || null,
        validated.categoryId.toString(),
        validated.location || null,
        validated.costCenterId?.toString() || null,
        validated.purchaseDate,
        validated.purchaseCost,
        validated.purchaseInvoiceId?.toString() || null,
        validated.usefulLifeYears || 5,
        validated.depreciationMethod,
        validated.residualValue || 0,
      ]
    );

    const asset = result.rows[0];

    // Post acquisition journal entry
    await createAssetJournal({
      tenantId: validated.tenantId,
      assetId: BigInt(asset.id),
      transactionType: "ACQUISITION",
      transactionDate: validated.purchaseDate,
      debitAmount: validated.purchaseCost,
      description: `Acquisition of ${validated.name}`,
      referenceNumber: `ACQ-${asset.code}`,
    });

    return asset;
  } catch (error) {
    console.error("Error creating asset:", error);
    throw error;
  }
}

export async function getAsset(assetId: bigint, tenantId: bigint): Promise<Asset | null> {
  try {
    const result = await db.query(
      `SELECT * FROM assets WHERE id = $1 AND tenant_id = $2`,
      [assetId.toString(), tenantId.toString()]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error("Error getting asset:", error);
    throw error;
  }
}

export async function getAssets(tenantId: bigint, filters?: any): Promise<Asset[]> {
  try {
    let query = "SELECT * FROM assets WHERE tenant_id = $1";
    const params: any[] = [tenantId.toString()];

    if (filters?.categoryId) {
      query += ` AND category_id = $${params.length + 1}`;
      params.push(filters.categoryId.toString());
    }
    if (filters?.assetStatus) {
      query += ` AND asset_status = $${params.length + 1}`;
      params.push(filters.assetStatus);
    }

    query += " ORDER BY purchase_date DESC";

    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    console.error("Error getting assets:", error);
    throw error;
  }
}

export async function getAssetRegisterSummaries(
  tenantId: bigint
): Promise<AssetRegisterSummary[]> {
  try {
    const result = await db.query(
      `SELECT * FROM asset_register_view WHERE tenant_id = $1 ORDER BY purchase_date DESC`,
      [tenantId.toString()]
    );
    return result.rows;
  } catch (error) {
    console.error("Error getting asset register summaries:", error);
    throw error;
  }
}

export async function updateAsset(
  assetId: bigint,
  tenantId: bigint,
  input: AssetUpdateInput
): Promise<Asset | null> {
  try {
    const validated = assetUpdateSchema.parse(input);

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (validated.name) {
      updates.push(`name = $${paramIndex++}`);
      params.push(validated.name);
    }
    if (validated.description) {
      updates.push(`description = $${paramIndex++}`);
      params.push(validated.description);
    }
    if (validated.location) {
      updates.push(`location = $${paramIndex++}`);
      params.push(validated.location);
    }
    if (validated.usefulLifeYears) {
      updates.push(`useful_life_years = $${paramIndex++}`);
      params.push(validated.usefulLifeYears);
    }
    if (validated.depreciationMethod) {
      updates.push(`depreciation_method = $${paramIndex++}`);
      params.push(validated.depreciationMethod);
    }
    if (validated.residualValue !== undefined) {
      updates.push(`residual_value = $${paramIndex++}`);
      params.push(validated.residualValue);
    }
    if (validated.assetStatus) {
      updates.push(`asset_status = $${paramIndex++}`);
      params.push(validated.assetStatus);
    }

    if (updates.length === 0) return getAsset(assetId, tenantId);

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(assetId.toString());
    params.push(tenantId.toString());

    const result = await db.query(
      `UPDATE assets SET ${updates.join(", ")} WHERE id = $${paramIndex + 1} AND tenant_id = $${paramIndex + 2} RETURNING *`,
      params
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error("Error updating asset:", error);
    throw error;
  }
}

/**
 * DEPRECIATION SCHEDULE OPERATIONS
 */

export async function calculateAndCreateDepreciationSchedules(
  assetId: bigint,
  tenantId: bigint,
  year: number,
  month: number
): Promise<DepreciationSchedule | null> {
  try {
    const asset = await getAsset(assetId, tenantId);
    if (!asset) return null;

    const periodStartDate = new Date(year, month - 1, 1);
    const periodEndDate = new Date(year, month, 0);

    // Get opening balance
    const previousSchedule = await db.query(
      `SELECT closing_net_book_value FROM depreciation_schedules
       WHERE asset_id = $1 AND period_year = $2 AND period_month = $3
       LIMIT 1`,
      [assetId.toString(), year, month > 1 ? month - 1 : 12]
    );

    let openingNBV = asset.net_book_value || asset.purchase_cost;
    if (previousSchedule.rows.length > 0) {
      openingNBV = previousSchedule.rows[0].closing_net_book_value;
    }

    // Calculate depreciation
    const depreciationAmount = calculateMonthlyDepreciation(
      asset.purchase_cost,
      asset.residual_value || 0,
      asset.useful_life_years,
      asset.depreciation_method as DepreciationMethod,
      openingNBV
    );

    const closingNBV = openingNBV - depreciationAmount;

    // Create schedule record
    const result = await db.query(
      `
      INSERT INTO depreciation_schedules (
        tenant_id, asset_id, period_year, period_month,
        period_start_date, period_end_date, opening_net_book_value,
        depreciation_rate, depreciation_amount, closing_net_book_value, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'CALCULATED')
      RETURNING *
      `,
      [
        tenantId.toString(),
        assetId.toString(),
        year,
        month,
        periodStartDate,
        periodEndDate,
        openingNBV,
        100 / (asset.useful_life_years * 12), // Monthly rate
        depreciationAmount,
        closingNBV,
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error calculating depreciation schedule:", error);
    throw error;
  }
}

export async function getDepreciationSchedules(
  assetId: bigint,
  tenantId: bigint
): Promise<DepreciationSchedule[]> {
  try {
    const result = await db.query(
      `SELECT * FROM depreciation_schedules WHERE asset_id = $1 AND tenant_id = $2 ORDER BY period_year DESC, period_month DESC`,
      [assetId.toString(), tenantId.toString()]
    );
    return result.rows;
  } catch (error) {
    console.error("Error getting depreciation schedules:", error);
    throw error;
  }
}

export async function postDepreciationSchedule(
  scheduleId: bigint,
  tenantId: bigint
): Promise<DepreciationSchedule | null> {
  try {
    // Get schedule
    const scheduleResult = await db.query(
      `SELECT * FROM depreciation_schedules WHERE id = $1 AND tenant_id = $2`,
      [scheduleId.toString(), tenantId.toString()]
    );

    if (scheduleResult.rows.length === 0) return null;

    const schedule = scheduleResult.rows[0];

    // Update asset accumulated depreciation
    await db.query(
      `UPDATE assets SET 
        accumulated_depreciation = accumulated_depreciation + $1,
        net_book_value = net_book_value - $1,
        last_depreciation_date = CURRENT_DATE
       WHERE id = $2`,
      [schedule.depreciation_amount, schedule.asset_id]
    );

    // Update schedule status
    const result = await db.query(
      `UPDATE depreciation_schedules SET is_posted = true, status = 'POSTED', posted_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [scheduleId.toString()]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error posting depreciation schedule:", error);
    throw error;
  }
}

export async function getDepreciationSummaries(
  tenantId: bigint
): Promise<DepreciationSummary[]> {
  try {
    const result = await db.query(
      `SELECT * FROM depreciation_summary_view WHERE tenant_id = $1`,
      [tenantId.toString()]
    );
    return result.rows;
  } catch (error) {
    console.error("Error getting depreciation summaries:", error);
    throw error;
  }
}

/**
 * ASSET JOURNAL OPERATIONS
 */

export async function createAssetJournal(journal: any): Promise<AssetJournal | null> {
  try {
    const result = await db.query(
      `
      INSERT INTO asset_journals (
        tenant_id, asset_id, transaction_type, transaction_date,
        debit_amount, credit_amount, description, reference_number, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'system')
      RETURNING *
      `,
      [
        journal.tenantId.toString(),
        journal.assetId.toString(),
        journal.transactionType,
        journal.transactionDate,
        journal.debitAmount || null,
        journal.creditAmount || null,
        journal.description || null,
        journal.referenceNumber || null,
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Error creating asset journal:", error);
    throw error;
  }
}

export async function getAssetJournals(
  assetId: bigint,
  tenantId: bigint
): Promise<AssetJournal[]> {
  try {
    const result = await db.query(
      `SELECT * FROM asset_journals WHERE asset_id = $1 AND tenant_id = $2 ORDER BY transaction_date DESC`,
      [assetId.toString(), tenantId.toString()]
    );
    return result.rows;
  } catch (error) {
    console.error("Error getting asset journals:", error);
    throw error;
  }
}

/**
 * ASSET DISPOSAL OPERATIONS
 */

export async function createAssetDisposal(
  input: AssetDisposalCreateInput
): Promise<AssetDisposal | null> {
  try {
    const validated = assetDisposalCreateSchema.parse(input);

    // Get asset for NBV calculation
    const asset = await getAsset(validated.assetId, validated.tenantId);
    if (!asset) return null;

    const gainLoss = (validated.salePrice || 0) - (asset.net_book_value || 0);

    const result = await db.query(
      `
      INSERT INTO asset_disposals (
        tenant_id, asset_id, disposal_date, disposal_method, sale_price,
        net_book_value_at_disposal, gain_loss, cash_receipt_account_id,
        gain_loss_account_id, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [
        validated.tenantId.toString(),
        validated.assetId.toString(),
        validated.disposalDate,
        validated.disposalMethod,
        validated.salePrice || null,
        asset.net_book_value,
        gainLoss,
        validated.cashReceiptAccountId?.toString() || null,
        validated.gainLossAccountId?.toString() || null,
        validated.notes || null,
      ]
    );

    // Mark asset as disposed
    await updateAsset(validated.assetId, validated.tenantId, {
      assetStatus: "DISPOSED",
    });

    return result.rows[0];
  } catch (error) {
    console.error("Error creating asset disposal:", error);
    throw error;
  }
}

export async function getAssetDisposal(
  disposalId: bigint,
  tenantId: bigint
): Promise<AssetDisposal | null> {
  try {
    const result = await db.query(
      `SELECT * FROM asset_disposals WHERE id = $1 AND tenant_id = $2`,
      [disposalId.toString(), tenantId.toString()]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error("Error getting asset disposal:", error);
    throw error;
  }
}

/**
 * HELPER FUNCTIONS
 */

function calculateMonthlyDepreciation(
  purchaseCost: number,
  residualValue: number,
  usefulLifeYears: number,
  method: DepreciationMethod,
  currentNBV: number
): number {
  if (method === "STRAIGHT_LINE") {
    // (Cost - Residual) / Total Months
    const depreciableAmount = purchaseCost - residualValue;
    const totalMonths = usefulLifeYears * 12;
    return depreciableAmount / totalMonths;
  } else if (method === "REDUCING_BALANCE") {
    // Annual rate / 12 months
    const annualRate = 2 / usefulLifeYears; // Double declining
    const monthlyRate = annualRate / 12;
    return currentNBV * monthlyRate;
  }

  return 0;
}

export async function generateBatchDepreciation(
  tenantId: bigint,
  year: number,
  month: number
): Promise<DepreciationSchedule[]> {
  try {
    const assets = await getAssets(tenantId, {
      assetStatus: "IN_USE",
    });

    const schedules: DepreciationSchedule[] = [];

    for (const asset of assets) {
      const schedule = await calculateAndCreateDepreciationSchedules(
        BigInt(asset.id),
        tenantId,
        year,
        month
      );

      if (schedule) {
        schedules.push(schedule);
      }
    }

    return schedules;
  } catch (error) {
    console.error("Error generating batch depreciation:", error);
    throw error;
  }
}

export async function revalueAsset(
  assetId: bigint,
  tenantId: bigint,
  newValue: number
): Promise<Asset | null> {
  try {
    const asset = await getAsset(assetId, tenantId);
    if (!asset) return null;

    const difference = newValue - (asset.net_book_value || 0);

    // Create revaluation journal
    await createAssetJournal({
      tenantId,
      assetId,
      transactionType: "REVALUATION",
      transactionDate: new Date(),
      debitAmount: difference > 0 ? difference : 0,
      creditAmount: difference < 0 ? Math.abs(difference) : 0,
      description: `Revaluation of ${asset.name}`,
      referenceNumber: `REV-${asset.code}-${new Date().toISOString().split("T")[0]}`,
    });

    // Update asset
    const result = await db.query(
      `UPDATE assets SET 
        net_book_value = $1,
        last_revaluation_date = CURRENT_DATE,
        last_revaluation_amount = $2,
        revaluation_count = revaluation_count + 1,
        asset_status = 'REVALUED',
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND tenant_id = $4 RETURNING *`,
      [newValue, newValue, assetId.toString(), tenantId.toString()]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error("Error revaluing asset:", error);
    throw error;
  }
}
