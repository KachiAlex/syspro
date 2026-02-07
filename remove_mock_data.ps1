# Script to remove all mock data from page.tsx
$filePath = "d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx"
$content = Get-Content $filePath -Raw

# Replace mock data arrays with empty arrays
$replacements = @{
    'const CRM_METRICS: KpiMetric\[\] = \[[^\]]*\];' = 'const CRM_METRICS: KpiMetric[] = [];'
    'const CRM_LEADS: CrmLead\[\] = \[[^\]]*?\n\];' = 'const CRM_LEADS: CrmLead[] = [];'
    'const CRM_TASKS: CrmTask\[\] = \[[^\]]*?\n\];' = 'const CRM_TASKS: CrmTask[] = [];'
    'const CRM_ENGAGEMENTS: CrmEngagement\[\] = \[[^\]]*?\n\];' = 'const CRM_ENGAGEMENTS: CrmEngagement[] = [];'
    'const CRM_REMINDERS: CrmReminder\[\] = \[[^\]]*?\n\];' = 'const CRM_REMINDERS: CrmReminder[] = [];'
    'const CRM_CUSTOMERS: CrmCustomerView\[\] = \[[^\]]*?\n\];' = 'const CRM_CUSTOMERS: CrmCustomerView[] = [];'
    'const CRM_CHARTS_BASELINE: CrmChartSnapshot = \{[^}]*?\n\};' = 'const CRM_CHARTS_BASELINE: CrmChartSnapshot = { funnel: [], revenueByOfficer: [], lostReasons: [] };'
    'const FINANCE_TREND_BASELINE: FinanceTrendSnapshot = \{[^}]*?\n\};' = 'const FINANCE_TREND_BASELINE: FinanceTrendSnapshot = { labels: [], revenue: [], expenses: [] };'
    'const FINANCE_RECEIVABLES_BASELINE: FinanceScheduleItem\[\] = \[[^\]]*?\n\];' = 'const FINANCE_RECEIVABLES_BASELINE: FinanceScheduleItem[] = [];'
    'const FINANCE_PAYABLES_BASELINE: FinanceScheduleItem\[\] = \[[^\]]*?\n\];' = 'const FINANCE_PAYABLES_BASELINE: FinanceScheduleItem[] = [];'
    'const FINANCE_EXPENSES_BASELINE: FinanceExpenseItem\[\] = \[[^\]]*?\n\];' = 'const FINANCE_EXPENSES_BASELINE: FinanceExpenseItem[] = [];'
    'const PAYMENT_RECORDS_BASELINE: PaymentRecord\[\] = \[[^\]]*?\n\];' = 'const PAYMENT_RECORDS_BASELINE: PaymentRecord[] = [];'
    'const EXPENSE_CATEGORIES_BASELINE: ExpenseCategory\[\] = \[[^\]]*?\n\];' = 'const EXPENSE_CATEGORIES_BASELINE: ExpenseCategory[] = [];'
    'const EXPENSE_RECORDS_BASELINE: Expense\[\] = \[[^\]]*?\n\];' = 'const EXPENSE_RECORDS_BASELINE: Expense[] = [];'
    'const FINANCE_CASH_ACCOUNTS_BASELINE: FinanceCashAccount\[\] = \[[^\]]*?\n\];' = 'const FINANCE_CASH_ACCOUNTS_BASELINE: FinanceCashAccount[] = [];'
    'const FINANCE_EXPENSE_BREAKDOWN_BASELINE: FinanceExpenseBreakdown\[\] = \[[^\]]*?\n\];' = 'const FINANCE_EXPENSE_BREAKDOWN_BASELINE: FinanceExpenseBreakdown[] = [];'
    'const MOCK_INVOICES: InvoiceItem\[\] = \[[^\]]*?\n\];' = 'const MOCK_INVOICES: InvoiceItem[] = [];'
    'const INVOICE_QUEUE: InvoiceRow\[\] = \[[^\]]*?\n\];' = 'const INVOICE_QUEUE: InvoiceRow[] = [];'
    'const DEAL_PIPELINE: DealOpportunity\[\] = \[[^\]]*?\n\];' = 'const DEAL_PIPELINE: DealOpportunity[] = [];'
    'const APPROVAL_ROUTES: ApprovalRoute\[\] = \[[^\]]*?\n\];' = 'const APPROVAL_ROUTES: ApprovalRoute[] = [];'
    'const ALERT_FEED: AlertItem\[\] = \[[^\]]*?\n\];' = 'const ALERT_FEED: AlertItem[] = [];'
    'const KPI_METRICS: KpiMetric\[\] = \[[^\]]*?\n\];' = 'const KPI_METRICS: KpiMetric[] = [];'
    'const LIVE_PANELS: LiveOperationPanel\[\] = \[[^\]]*?\n\];' = 'const LIVE_PANELS: LiveOperationPanel[] = [];'
    'const ACTIVITY_LOG = \[[^\]]*?\n\];' = 'const ACTIVITY_LOG = [];'
}

foreach ($pattern in $replacements.Keys) {
    $replacement = $replacements[$pattern]
    $content = [System.Text.RegularExpressions.Regex]::Replace($content, $pattern, $replacement, [System.Text.RegularExpressions.RegexOptions]::Singleline)
}

Set-Content $filePath -Value $content
Write-Host "Mock data removal complete"
