#!/usr/bin/env python3
"""
Simply and aggressively fix: Remove ALL lines that are orphaned JSX (not return statements)
appearing between case statements within a switch block.
"""

with open(r"d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx", "r") as f:
    lines = f.readlines()

# Strategy: Go through and find all case statements.
# For each case, the NEXT line should start with "return"
# If it doesn't, delete all lines until the next case statement
lines_to_delete = []

i = 0
while i < len(lines):
    line = lines[i].strip()
    
    # Check if this is a case statement  
    if line.startswith('case "') and ':' in line:
        # This is a case statement. Check the next line.
        if i + 1 < len(lines):
            next_line = lines[i + 1].strip()
            
            # If next line doesn't start with "return", it's orphaned code
            if not next_line.startswith("return "):
                print(f"Found orphaned code at line {i+2} (after case on line {i+1})")
                print(f"  Case line: {line}")
                print(f"  Next line: {next_line}")
                
                # Find the end of this orphaned block (next case statement or end of switch)
                start_delete = i + 1
                end_delete = i + 1
                
                for j in range(i + 1, len(lines)):
                    if lines[j].strip().startswith('case "') or lines[j].strip() == "default:":
                        end_delete = j
                        break
                    end_delete = j + 1
                
                # Mark these lines for deletion
                lines_to_delete.extend(range(start_delete, end_delete))
                print(f"  Will delete lines {start_delete+1} to {end_delete}")
                
                # Skip ahead past the orphaned block
                i = end_delete - 1
    
    i += 1

# Delete marked lines (from highest index first to avoid shifting)
if lines_to_delete:
    lines_to_delete = sorted(set(lines_to_delete), reverse=True)
    for idx in lines_to_delete:
        del lines[idx]
    
    print(f"\n✓ Deleted {len(lines_to_delete)} lines of orphaned code")
    
    # Write back
    with open(r"d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx", "w") as f:
        f.writelines(lines)
    
    print("✓ File fixed!")
else:
    print("No orphaned code found")
