#!/usr/bin/env python3
"""Remove all orphaned JSX/code between case statements"""

with open(r"d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx", "r") as f:
    lines = f.readlines()

# Read the file and find which lines to keep
# Process case statements and their returns
# Skip everything that's orphaned (code not in a proper return statement)

output = []
i = 0

while i < len(lines):
    line = lines[i]
    
    # Check if this is a case statement
    if line.strip().startswith('case "') and ':' in line:
        output.append(line)
        i += 1
        
        # Next should be a return
        if i < len(lines) and 'return' in lines[i]:
            return_line = lines[i]
            output.append(return_line)
            i += 1
            
            # If multi-line return, collect until it ends
            if '(' in return_line and not return_line.rstrip().endswith(';'):
                paren_count = return_line.count('(') - return_line.count(')')
                
                while i < len(lines) and paren_count > 0:
                    next_line = lines[i] 
                    output.append(next_line)
                    paren_count += next_line.count('(') - next_line.count(')')
                    i += 1
            
            # Skip ALL orphaned lines until next case, default, or closing brace
            while i < len(lines):
                next_line = lines[i]
                
                # Stop if we hit next case, default, or switch closing
                if (next_line.strip().startswith('case "') or 
                    next_line.strip().startswith('default') or 
                    (next_line.strip() == '}' and i > 1000)):  # switch closing is far down
                    break
                
                # Skip this orphaned line
                i += 1
        else:
            # No return after case - skip until next case
            while i < len(lines):
                if (lines[i].strip().startswith('case "') or 
                    lines[i].strip().startswith('default')):
                    break
                i += 1
    
    elif line.strip().startswith('default') or line.strip().startswith('}'):
        # Copy default and closing braces as-is
        output.append(line)
        i += 1
    
    elif line.strip() == '' or line.strip().startswith('//'):
        # Keep blank lines and comments
        output.append(line)
        i += 1
    else:
        # Skip orphaned code
        i += 1

# Write back
with open(r"d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx", "w") as f:
    f.writelines(output)

print(f"✓ Cleaned file: kept {len(output)} lines out of {len(lines)}")
print(f"  Removed {len(lines) - len(output)} orphaned lines")
