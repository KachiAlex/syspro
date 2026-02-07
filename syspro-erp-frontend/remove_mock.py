#!/usr/bin/env python3
import re

file_path = r"d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# List of all mock data constants
constants = [
    "CRM_METRICS",
    "CRM_LEADS",
    "CRM_TASKS",
    "CRM_ENGAGEMENTS",
    "CRM_STATUS_META",
    "CRM_REMINDERS",
    "CRM_CUSTOMERS",
    "CRM_CHARTS_BASELINE",
    "CRM_BASELINE_SNAPSHOT",
    "FINANCE_TREND_BASELINE",
    "FINANCE_RECEIVABLES_BASELINE",
    "FINANCE_PAYABLES_BASELINE",
    "FINANCE_EXPENSES_BASELINE",
    "PAYMENT_RECORDS_BASELINE",
    "EXPENSE_CATEGORIES_BASELINE",
    "EXPENSE_RECORDS_BASELINE",
    "FINANCE_CASH_ACCOUNTS_BASELINE",
    "FINANCE_EXPENSE_BREAKDOWN_BASELINE",
    "FINANCE_BASELINE_SNAPSHOT",
    "MOCK_INVOICES",
    "INVOICE_QUEUE",
    "DEAL_PIPELINE",
    "APPROVAL_ROUTES",
    "ALERT_FEED",
    "KPI_METRICS",
    "LIVE_PANELS",
    "ACTIVITY_LOG",
]

removed_count = 0
for const_name in constants:
    # Pattern to match: const NAME: TYPE = [...] or {...} followed by semicolon
    # Uses non-greedy matching with flags to handle multiline
    pattern = rf"const\s+{re.escape(const_name)}\s*:\s*[^=]+=\s*(?:\[(?:[^\[\]]*|\[.*?\])*\]|\{{(?:[^{{}}]*|{{.*?}})*\}})\s*;\n?"
    
    matches = list(re.finditer(pattern, content, re.MULTILINE | re.DOTALL))
    if matches:
        # Replace with empty array
        new_content = re.sub(pattern, f"const {const_name} = [];\n", content, flags=re.MULTILINE | re.DOTALL)
        if new_content != content:
            content = new_content
            removed_count += 1
            print(f"✓ Removed {const_name}")
        else:
            print(f"✗ Pattern found but replacement failed for {const_name}")
    else:
        print(f"! Pattern not found for {const_name}")

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nTotal constants removed: {removed_count}")
print(f"File saved: {file_path}")
