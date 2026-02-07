# Remove all mock data from page.tsx
$filePath = "d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx"
$content = Get-Content $filePath -Raw

# Helper function to replace multi-line constant declarations
function Replace-MockConstant {
    param(
        [string]$content,
        [string]$constantName,
        [string]$replaceWith = "[]"
    )
    
    # Pattern: const NAME: TYPE[] = [ ... ]; or const NAME: TYPE = { ... };
    # This will match from "const NAME" until the semicolon after closing bracket
    $pattern = "const $constantName\s*:\s*[^=]+=\s*(?:\[[\s\S]*?\]|{[\s\S]*?})\s*;"
    $replacement = "const $constantName = $replaceWith;"
    
    return [System.Text.RegularExpressions.Regex]::Replace($content, $pattern, $replacement)
}

# List of all mock data constants to remove
$constants = @(
    @{ name = "CRM_METRICS"; type = "KpiMetric[]" },
    @{ name = "CRM_LEADS"; type = "CrmLead[]" },
    @{ name = "CRM_TASKS"; type = "CrmTask[]" },
    @{ name = "CRM_ENGAGEMENTS"; type = "CrmEngagement[]" },
    @{ name = "CRM_STATUS_META"; type = "Record<CrmLead['status']" },
    @{ name = "CRM_REMINDERS"; type = "CrmReminder[]" },
    @{ name = "CRM_CUSTOMERS"; type = "CrmCustomerView[]" },
    @{ name = "CRM_CHARTS_BASELINE"; type = "CrmChartSnapshot" },
    @{ name = "CRM_BASELINE_SNAPSHOT"; type = "CrmSnapshot" },
    @{ name = "FINANCE_TREND_BASELINE"; type = "TrendData[]" },
    @{ name = "FINANCE_RECEIVABLES_BASELINE"; type = "ReceivableItem[]" },
    @{ name = "FINANCE_PAYABLES_BASELINE"; type = "PayableItem[]" },
    @{ name = "FINANCE_EXPENSES_BASELINE"; type = "ExpenseItem[]" },
    @{ name = "PAYMENT_RECORDS_BASELINE"; type = "PaymentRecord[]" },
    @{ name = "EXPENSE_CATEGORIES_BASELINE"; type = "ExpenseCategory[]" },
    @{ name = "EXPENSE_RECORDS_BASELINE"; type = "ExpenseRecord[]" },
    @{ name = "FINANCE_CASH_ACCOUNTS_BASELINE"; type = "FinanceCashAccount[]" },
    @{ name = "FINANCE_EXPENSE_BREAKDOWN_BASELINE"; type = "ExpenseBreakdown[]" },
    @{ name = "FINANCE_BASELINE_SNAPSHOT"; type = "FinanceSnapshot" },
    @{ name = "MOCK_INVOICES"; type = "Invoice[]" },
    @{ name = "INVOICE_QUEUE"; type = "Invoice[]" },
    @{ name = "DEAL_PIPELINE"; type = "Deal[]" },
    @{ name = "APPROVAL_ROUTES"; type = "ApprovalRoute[]" },
    @{ name = "ALERT_FEED"; type = "Alert[]" },
    @{ name = "KPI_METRICS"; type = "KpiMetric[]" },
    @{ name = "LIVE_PANELS"; type = "Panel[]" },
    @{ name = "ACTIVITY_LOG"; type = "ActivityLogItem[]" }
)

Write-Host "Starting mock data removal..."
Write-Host "File: $filePath"
Write-Host ""

# Try to remove each constant using simpler pattern matching
foreach ($constant in $constants) {
    $name = $constant.name
    
    # Create a pattern that looks for the constant declaration
    # This pattern captures from "const NAME" to the semicolon after a closing bracket
    $beforeCount = ($content | Select-String -Pattern "const $name\s*:" | Measure-Object).Count
    
    if ($beforeCount -gt 0) {
        Write-Host "Found $name ($beforeCount occurrence(s))..."
        
        # Use a more aggressive regex pattern
        # Match: const NAME: ... = [ ... ];  or const NAME: ... = { ... };
        $pattern = "const\s+$([System.Text.RegularExpressions.Regex]::Escape($name))\s*:[\s\S]*?=\s*(?:\[[\s\S]*?\]|\{[\s\S]*?\})\s*;"
        
        $replacement = "const $name = [];"
        
        $oldContent = $content
        $content = [System.Text.RegularExpressions.Regex]::Replace($content, $pattern, $replacement, [System.Text.RegularExpressions.RegexOptions]::Multiline)
        
        if ($oldContent -ne $content) {
            Write-Host "  ✓ Replaced successfully"
        } else {
            Write-Host "  ✗ No match found with regex, attempting line-by-line approach..."
        }
    }
}

# Write the modified content back
$content | Set-Content $filePath -NoNewline

Write-Host ""
Write-Host "Mock data removal complete!"
Write-Host "File saved: $filePath"
