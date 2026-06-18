#!/usr/bin/env python3
"""
Remove dangling old JSX code from page.tsx after new component return statements.
"""

with open(r'd:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find case statements and their corresponding component returns
# Pattern: case "xxx": return <Component... />;
# Everything between this and the next `case` should be removed

output = []
i = 0
while i < len(lines):
    line = lines[i]
    
    # Check if this is a case statement with a component return
    if 'case "' in line and 'return <' in lines[i] and '/>;' in lines[i]:
        # This line has: case "xxx": return <Component tenantSlug={tenantSlug} />;
        output.append(line)
        i += 1
        
        # Skip old JSX until we find the next case statement
        while i < len(lines):
            next_line = lines[i]
            if next_line.strip().startswith('case "'):
                break
            i += 1
    else:
        output.append(line)
        i += 1

# Write back
with open(r'd:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx', 'w', encoding='utf-8') as f:
    f.writelines(output)

print("Cleanup complete!")
print(f"Removed lines from {len(lines)} to {len(output)}")
