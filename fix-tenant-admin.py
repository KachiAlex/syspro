#!/usr/bin/env python3
"""
Fix tenant-admin/page.tsx by removing all orphaned code between 
Valid procurement case and valid inventory case.
"""

import re

# Read file
with open(r"d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx", "r") as f:
    content = f.read()

# Strategy: Find the procurement return statement and the valid inventory case
# Remove everything between them

# Find key patterns for identify where valid cases are
procurement_return = 'case "procurement":\n        return <Procurement tenantSlug={tenantSlug} />;'
valid_inventory_case = 'case "inventory":\n        return (\n          <div className="p-6">\n            <div className="mb-6">\n              <h2 className="text-2xl font-bold text-gray-900 mb-2">Inventory Management</h2>'

# Check if these exist
if procurement_return in content and valid_inventory_case in content:
    # Find indices
    procurement_idx = content.find(procurement_return)
    inventory_idx = content.find(valid_inventory_case)
    
    print(f"Found procurement at index: {procurement_idx}")
    print(f"Found valid inventory at index: {inventory_idx}")
    
    if procurement_idx > 0 and inventory_idx > procurement_idx:
        # Build the fixed content
        before = content[:procurement_idx + len(procurement_return)]
        after = content[inventory_idx:]
        
        # Add a blank line between them for formatting
        fixed_content = before + "\n      \n      " + after
        
        # Write back
        with open(r"d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx", "w") as f:
            f.write(fixed_content)
        
        # Calculate removed size
        removed_size = inventory_idx - (procurement_idx + len(procurement_return))
        print(f"✓ Fixed! Removed {removed_size} characters of orphaned code")
    else:
        print("✗ Could not find proper ordering of cases")
else:
    print("Looking for alternate patterns...")
    
    # Try with more flexible matching
    lines = content.split("\n")
    
    # Find line numbers for key cases
    procurement_lines = []
    inventory_lines = []
    
    for i, line in enumerate(lines):
        if 'case "procurement":' in line and 'return <Procurement' in lines[i+1] if i+1 < len(lines) else False:
            procurement_lines.append(i)
        if 'case "inventory":' in line and 'return (' in lines[i+1] if i+1 < len(lines) else False:
            inventory_lines.append(i)
    
    print(f"Found procurement cases at lines: {procurement_lines}")
    print(f"Found inventory cases at lines: {inventory_lines}")
    
    if len(procurement_lines) > 0 and len(inventory_lines) > 0:
        # Get the LAST valid procurement and first valid inventory AFTER it
        last_procurement_idx = procurement_lines[-1] if procurement_lines else -1
        first_valid_inventory_idx = next((idx for idx in inventory_lines if idx > last_procurement_idx + 5), -1)
        
        if last_procurement_idx >= 0 and first_valid_inventory_idx >= 0:
            print(f"Will keep procurement at line {last_procurement_idx}")
            print(f"Will keep inventory at line {first_valid_inventory_idx}")
            
            # Build new content
            keep_lines = lines[:last_procurement_idx+2] + lines[first_valid_inventory_idx:]
            fixed_content = "\n".join(keep_lines)
            
            with open(r"d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx", "w") as f:
                f.write(fixed_content)
            
            removed_lines = first_valid_inventory_idx - (last_procurement_idx + 2)
            print(f"✓ Fixed! Removed {removed_lines} lines of orphaned code")
        else:
            print("✗ Could not find proper structure")
    else:
        print("✗ Could not locate valid case statements")
