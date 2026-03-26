/**
 * Vendor Analytics & Reporting Service
 * Provides comprehensive reporting for vendor spend, aging, risk analysis, etc.
 */

import { db, sql as SQL } from "../sql-client";

export interface VendorSpendReport {
  vendorId: string;
  vendorName: string;
  totalSpend: number;
  billCount: number;
  avgBillAmount: number;
  paymentCount: number;
  lastTransactionDate: string;
  spendTrend: Array<{
    period: string;
    amount: number;
  }>;
}

export interface VendorAgingReport {
  vendorId: string;
  vendorName: string;
  current: number; // 0-30 days
  days31: number; // 31-60 days
  days61: number; // 61-90 days
  days90: number; // 90+ days
  total: number;
  oldestOverdueDays: number;
}

export interface POResponse {
  vendorId: string;
  vendorName: string;
  totalPOs: number;
  totalPOValue: number;
  avgPOValue: number;
  fulfillmentRate: number;
  avgFulfillmentDays: number;
  varianceRate: number; // PO vs Bill variance
}

export interface VendorRiskScore {
  vendorId: string;
  vendorName: string;
  riskScore: number; // 0-100
  riskLevel: "low" | "medium" | "high" | "critical";
  factors: {
    paymentHistory: number;
    agingBalance: number;
    transactionFrequency: number;
    relationshipLength: number;
    complianceScore: number;
  };
  recommendations: string[];
}

export interface TaxReport {
  vendorId: string;
  vendorName: string;
  taxId: string;
  totalTaxWithheld: number;
  vatInput: number;
  withholdingTax: number;
  period: string;
  complianceStatus: "compliant" | "pending" | "non_compliant";
}

/* using imported SQL */

export async function getVendorSpendReport(
  tenantSlug: string,
  filters?: {
    vendorId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }
): Promise<VendorSpendReport[]> {
  const sql = SQL;

  const params: any[] = [];
  let idx = 1;
  // bills filters
  let billWhere = `b.tenant_slug = $${idx}`;
  params.push(tenantSlug);
  idx++;
  if (filters?.vendorId) {
    billWhere += ` and b.vendor_id = $${idx}`;
    params.push(filters.vendorId);
    idx++;
  }
  if (filters?.dateFrom) {
    billWhere += ` and b.bill_date >= $${idx}`;
    params.push(filters.dateFrom);
    idx++;
  }
  if (filters?.dateTo) {
    billWhere += ` and b.bill_date <= $${idx}`;
    params.push(filters.dateTo);
    idx++;
  }

  // payment_stats filters (reuse tenant and optional vendorId)
  const paymentWhere = filters?.vendorId ? `vp.tenant_slug = $1 and vp.vendor_id = $2` : `vp.tenant_slug = $1`;

  // monthly_trend filters (tenantSlug + optional vendor)
  const monthlyWhere = filters?.vendorId ? `b.tenant_slug = $1 and b.bill_date >= date_trunc('month', current_date - interval '11 months') and b.vendor_id = $2` : `b.tenant_slug = $1 and b.bill_date >= date_trunc('month', current_date - interval '11 months')`;

  const limitClause = filters?.limit ? `limit ${Number(filters.limit)}` : "";

  const queryText = `with vendor_spend as (
      select 
        b.vendor_id,
        v.legal_name as vendor_name,
        sum(b.total) as total_spend,
        count(b.id) as bill_count,
        max(b.bill_date) as last_bill_date
      from bills b
      join vendors v on b.vendor_id = v.id
      where ${billWhere}
      group by b.vendor_id, v.legal_name
    ),
    payment_stats as (
      select 
        vp.vendor_id,
        count(vp.id) as payment_count,
        max(vp.payment_date) as last_payment_date
      from vendor_payments vp
      where ${paymentWhere}
      group by vp.vendor_id
    ),
    monthly_trend as (
      select 
        b.vendor_id,
        date_trunc('month', b.bill_date)::text as period,
        sum(b.total) as amount
      from bills b
      where ${monthlyWhere}
      group by b.vendor_id, date_trunc('month', b.bill_date)
      order by period
    )
    select 
      vs.vendor_id,
      vs.vendor_name,
      vs.total_spend,
      vs.bill_count,
      vs.avg_bill_amount,
      coalesce(ps.payment_count, 0) as payment_count,
      coalesce(greatest(vs.last_bill_date, ps.last_payment_date), vs.last_bill_date) as last_transaction_date,
      (
        select json_agg(
          json_build_object(
            'period', period,
            'amount', amount
          ) order by period
        )
        from monthly_trend mt
        where mt.vendor_id = vs.vendor_id
      ) as spend_trend
    from vendor_spend vs
    left join payment_stats ps on vs.vendor_id = ps.vendor_id
    order by vs.total_spend desc
    ${limitClause}`;

  const results = (await db.query<any>(queryText, params)).rows;

  return results.map(row => ({
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    totalSpend: Number(row.total_spend),
    billCount: Number(row.bill_count),
    avgBillAmount: Number(row.avg_bill_amount),
    paymentCount: Number(row.payment_count),
    lastTransactionDate: row.last_transaction_date,
    spendTrend: row.spend_trend || []
  }));
}

export async function getVendorAgingReport(
  tenantSlug: string,
  filters?: {
    vendorId?: string;
    includePaid?: boolean;
  }
): Promise<VendorAgingReport[]> {
  const sql = SQL;

  const params: any[] = [tenantSlug];
  let whereText = `b.tenant_slug = $1`;
  if (filters?.vendorId) {
    params.push(filters.vendorId);
    whereText += ` and b.vendor_id = $2`;
  }
  if (!filters?.includePaid) {
    whereText += ` and b.balance_due > 0`;
  }

  const queryText = `with aging_buckets as (
      select 
        b.vendor_id,
        v.legal_name as vendor_name,
        case 
          when b.due_date >= current_date - interval '30 days' then b.balance_due
          else 0
        end as current,
        case 
          when b.due_date >= current_date - interval '60 days' 
          and b.due_date < current_date - interval '30 days' then b.balance_due
          else 0
        end as days31,
        case 
          when b.due_date >= current_date - interval '90 days' 
          and b.due_date < current_date - interval '60 days' then b.balance_due
          else 0
        end as days61,
        case 
          when b.due_date < current_date - interval '90 days' then b.balance_due
          else 0
        end as days90,
        b.balance_due,
        b.due_date,
        b.bill_date
      from bills b
      join vendors v on b.vendor_id = v.id
      where ${whereText}
    ),
    aging_summary as (
      select 
        vendor_id,
        vendor_name,
        sum(current) as current,
        sum(days31) as days31,
        sum(days61) as days61,
        sum(days90) as days90,
        sum(balance_due) as total,
        max(case when due_date < current_date then current_date - due_date else 0 end) as oldest_overdue_days
      from aging_buckets
      group by vendor_id, vendor_name
    )
    select 
      vendor_id,
      vendor_name,
      coalesce(current, 0) as current,
      coalesce(days31, 0) as days31,
      coalesce(days61, 0) as days61,
      coalesce(days90, 0) as days90,
      coalesce(total, 0) as total,
      coalesce(oldest_overdue_days, 0) as oldest_overdue_days
    from aging_summary
    order by total desc`;

  const results = (await db.query<any>(queryText, params)).rows;

  return results.map(row => ({
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    current: Number(row.current),
    days31: Number(row.days31),
    days61: Number(row.days61),
    days90: Number(row.days90),
    total: Number(row.total),
    oldestOverdueDays: Number(row.oldest_overdue_days)
  }));
}

export async function getVendorRiskScores(
  tenantSlug: string,
  filters?: {
    vendorId?: string;
  }
): Promise<VendorRiskScore[]> {
  const sql = SQL;

  const whereClause = filters?.vendorId 
    ? sql`where v.id = ${filters.vendorId}`
    : sql``;

  const results = (await sql`
    with vendor_metrics as (
      select 
        v.id as vendor_id,
        v.legal_name as vendor_name,
        -- Payment history score (0-100)
        case 
          when count(vp.id) = 0 then 50
          when sum(case when vp.status = 'reconciled' then 1 else 0 end)::float / count(vp.id) > 0.9 then 90
          when sum(case when vp.status = 'reconciled' then 1 else 0 end)::float / count(vp.id) > 0.7 then 70
          when sum(case when vp.status = 'reconciled' then 1 else 0 end)::float / count(vp.id) > 0.5 then 50
          else 30
        end as payment_history_score,
        -- Aging balance score (0-100)
        case 
          when coalesce(sum(b.balance_due), 0) = 0 then 100
          when coalesce(sum(b.balance_due), 0) < 10000 then 80
          when coalesce(sum(b.balance_due), 0) < 50000 then 60
          when coalesce(sum(b.balance_due), 0) < 100000 then 40
          else 20
        end as aging_score,
        -- Transaction frequency score (0-100)
        case 
          when count(b.id) = 0 then 30
          when count(b.id) > 50 then 90
          when count(b.id) > 20 then 70
          when count(b.id) > 10 then 50
          else 40
        end as frequency_score,
        -- Relationship length score (0-100)
        case 
          when extract(days from current_date - min(v.created_at)) > 1095 then 90 -- 3+ years
          when extract(days from current_date - min(v.created_at)) > 730 then 80  -- 2+ years
          when extract(days from current_date - min(v.created_at)) > 365 then 60  -- 1+ year
          when extract(days from current_date - min(v.created_at)) > 180 then 40  -- 6+ months
          else 20
        end as relationship_score,
        -- Compliance score (0-100) - based on tax info completeness
        case 
          when v.tax_id is not null and v.bank_details is not null then 90
          when v.tax_id is not null or v.bank_details is not null then 70
          else 40
        end as compliance_score
      from vendors v
      left join vendor_payments vp on v.id = vp.vendor_id and vp.tenant_slug = ${tenantSlug}
      left join bills b on v.id = b.vendor_id and b.tenant_slug = ${tenantSlug}
      where v.tenant_slug = ${tenantSlug}
      ${whereClause}
      group by v.id, v.legal_name, v.created_at, v.tax_id, v.bank_details
    )
    select 
      vendor_id,
      vendor_name,
      -- Weighted risk score (lower is better, so we invert)
      round((
        (100 - payment_history_score) * 0.3 +
        (100 - aging_score) * 0.25 +
        (100 - frequency_score) * 0.15 +
        (100 - relationship_score) * 0.15 +
        (100 - compliance_score) * 0.15
      )) as risk_score,
      payment_history_score,
      aging_score,
      frequency_score,
      relationship_score,
      compliance_score
    from vendor_metrics
    order by risk_score desc
  `) as any[];

  return results.map(row => {
    const riskScore = Number(row.risk_score);
    let riskLevel: "low" | "medium" | "high" | "critical";
    
    if (riskScore < 25) riskLevel = "low";
    else if (riskScore < 50) riskLevel = "medium";
    else if (riskScore < 75) riskLevel = "high";
    else riskLevel = "critical";

    const recommendations: string[] = [];
    if (row.payment_history_score < 60) {
      recommendations.push("Review payment history and consider stricter payment terms");
    }
    if (row.aging_score < 60) {
      recommendations.push("High aging balance - follow up on overdue payments");
    }
    if (row.frequency_score < 50) {
      recommendations.push("Low transaction frequency - evaluate relationship value");
    }
    if (row.compliance_score < 60) {
      recommendations.push("Incomplete compliance information - update vendor details");
    }

    return {
      vendorId: row.vendor_id,
      vendorName: row.vendor_name,
      riskScore,
      riskLevel,
      factors: {
        paymentHistory: Number(row.payment_history_score),
        agingBalance: Number(row.aging_score),
        transactionFrequency: Number(row.frequency_score),
        relationshipLength: Number(row.relationship_score),
        complianceScore: Number(row.compliance_score)
      },
      recommendations
    };
  });
}

export async function getTaxReport(
  tenantSlug: string,
  filters?: {
    vendorId?: string;
    period?: string; // YYYY-MM format
  }
): Promise<TaxReport[]> {
  const sql = SQL;

  const whereConditions: any[] = [];
  whereConditions.push(sql`b.tenant_slug = ${tenantSlug}`);
  
  if (filters?.vendorId) {
    whereConditions.push(sql`b.vendor_id = ${filters.vendorId}`);
  }
  
  if (filters?.period) {
    whereConditions.push(sql`date_trunc('month', b.bill_date)::text = ${filters.period}`);
  }

  const whereClause = whereConditions.length > 0 
    ? SQL`where ${db.join(whereConditions, ' and ')}`
    : sql``;

  const results = (await sql`
    select 
      b.vendor_id,
      v.legal_name as vendor_name,
      v.tax_id,
      sum(b.taxes) as total_tax_withheld,
      -- Estimate VAT input (assuming 7.5% VAT rate)
      sum(b.taxes) * 0.75 as vat_input,
      -- Estimate withholding tax (assuming 5% WHT rate)
      sum(b.taxes) * 0.25 as withholding_tax,
      coalesce(date_trunc('month', b.bill_date)::text, date_trunc('month', current_date)::text) as period,
      case 
        when v.tax_id is not null then 'compliant'
        when sum(b.total) > 100000 then 'non_compliant'
        else 'pending'
      end as compliance_status
    from bills b
    join vendors v on b.vendor_id = v.id
    ${whereClause}
    group by b.vendor_id, v.legal_name, v.tax_id, date_trunc('month', b.bill_date)
    order by total_tax_withheld desc
  `) as any[];

  return results.map(row => ({
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    taxId: row.tax_id,
    totalTaxWithheld: Number(row.total_tax_withheld),
    vatInput: Number(row.vat_input),
    withholdingTax: Number(row.withholding_tax),
    period: row.period,
    complianceStatus: row.compliance_status
  }));
}

export async function getDashboardAnalytics(tenantSlug: string): Promise<{
  totalVendors: number;
  activeVendors: number;
  totalSpend: number;
  outstandingPayables: number;
  overdueAmount: number;
  pendingApprovals: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  monthlyTrend: Array<{
    month: string;
    spend: number;
    payments: number;
  }>;
}> {
  const sql = SQL;

  const results = (await sql`
    with vendor_stats as (
      select 
        count(*) as total_vendors,
        count(*) filter (where is_active = true) as active_vendors
      from vendors 
      where tenant_slug = ${tenantSlug}
    ),
    spend_stats as (
      select 
        coalesce(sum(total), 0) as total_spend,
        coalesce(sum(balance_due), 0) as outstanding_payables,
        coalesce(sum(case when status = 'overdue' then balance_due else 0 end), 0) as overdue_amount
      from bills 
      where tenant_slug = ${tenantSlug}
    ),
    approval_stats as (
      select count(*) as pending_approvals
      from approvals 
      where tenant_slug = ${tenantSlug} and status = 'pending'
    ),
    monthly_data as (
      select 
        date_trunc('month', created_at)::text as month,
        sum(case when entity_type = 'bill' then 
          (metadata->>'total')::numeric else 0 end
        ) as spend,
        sum(case when entity_type = 'payment' then 
          (metadata->>'amount')::numeric else 0 end
        ) as payments
      from journal_entries 
      where tenant_slug = ${tenantSlug}
        and created_at >= date_trunc('month', current_date - interval '11 months')
      group by date_trunc('month', created_at)
      order by month
    )
    select 
      vs.total_vendors,
      vs.active_vendors,
      ss.total_spend,
      ss.outstanding_payables,
      ss.overdue_amount,
      coalesce(apps.pending_approvals, 0) as pending_approvals,
      (
        select json_agg(
          json_build_object(
            'month', month,
            'spend', coalesce(spend, 0),
            'payments', coalesce(payments, 0)
          ) order by month
        )
        from monthly_data
      ) as monthly_trend
    from vendor_stats vs
    cross join spend_stats ss
    left join approval_stats apps on true
  `) as any[];

  const result = results[0];
  
  // Get risk distribution
  const riskScores = await getVendorRiskScores(tenantSlug);
  const riskDistribution = {
    low: riskScores.filter(r => r.riskLevel === 'low').length,
    medium: riskScores.filter(r => r.riskLevel === 'medium').length,
    high: riskScores.filter(r => r.riskLevel === 'high').length,
    critical: riskScores.filter(r => r.riskLevel === 'critical').length
  };

  return {
    totalVendors: Number(result.total_vendors),
    activeVendors: Number(result.active_vendors),
    totalSpend: Number(result.total_spend),
    outstandingPayables: Number(result.outstanding_payables),
    overdueAmount: Number(result.overdue_amount),
    pendingApprovals: Number(result.pending_approvals),
    riskDistribution,
    monthlyTrend: result.monthly_trend || []
  };
}
