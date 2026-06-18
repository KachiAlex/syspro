#!/usr/bin/env python3
"""
Fix page.tsx to integrate CRM Dashboard component
Replaces inline CRM cases with dynamic CRMDashboard imports
"""

import re

# Read the file
with open('syspro-erp-frontend/src/app/tenant-admin/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add CRMDashboard import after Marketing
crm_import = 'const CRMDashboard = dynamic<ComponentType<any>>(() => import("./sections/crm-dashboard").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading CRM…</div> });'
marketing_import = 'const Marketing = dynamic<ComponentType<any>>(() => import("./sections/marketing-sales-dashboard").then((m) => m.default), { ssr: false, loading: () => <div className="p-6">Loading Marketing…</div> });'

if crm_import not in content:
    content = content.replace(
        marketing_import + '\n',
        marketing_import + '\n' + crm_import + '\n'
    )
    print("✓ Added CRMDashboard import")

# 2. Find and replace the four CRM case statements
# This is a large pattern replacement - we're replacing the entire implementation
# of crm, leads, contacts, and deals cases with simplified versions

# The pattern starts with "// CRM & Sales Modules" and ends just before "// Finance & Accounting Modules"
pattern = r'      // CRM & Sales Modules\n      case "crm":\n        return \(\n          <div className="p-6">.*?// Finance & Accounting Modules'

replacement = '''      // CRM & Sales Modules
      case "crm":
        return <CRMDashboard tenantSlug={tenantSlug} initialTab="overview" />;
      
      case "leads":
        return <CRMDashboard tenantSlug={tenantSlug} initialTab="leads" />;
      
      case "contacts":
        return <CRMDashboard tenantSlug={tenantSlug} initialTab="contacts" />;
      
      case "deals":
        return <CRMDashboard tenantSlug={tenantSlug} initialTab="deals" />;
      
      // Finance & Accounting Modules'''

# Use DOTALL flag so . matches newlines
content = re.sub(pattern, replacement, content, flags=re.DOTALL)
print("✓ Replaced CRM/Leads/Contacts/Deals cases with CRMDashboard")

# Write the file back
with open('syspro-erp-frontend/src/app/tenant-admin/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Successfully updated page.tsx")
