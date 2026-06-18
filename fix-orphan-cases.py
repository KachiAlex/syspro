#!/usr/bin/env python3
"""
Final fix: Remove all orphaned code between valid case statements.
The issue is that case statements after "inventory" have orphaned JSX code
that needs to be deleted.
"""

with open(r"d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx", "r") as f:
    lines = f.readlines()

# Find all case statements and their types
cases = []
for i, line in enumerate(lines):
    if 'case "' in line and ':' in line:
        # Extract case name
        match = line.split('case "')[1].split('"')[0]
        cases.append((i, match, line.strip()))

print("Found cases:")
for idx, (line_num, case_name, full_line) in enumerate(cases):
    if idx < len(cases) - 1:
        next_case_line = cases[idx+1][0]
        lines_in_case = next_case_line - line_num
    else:
        lines_in_case = "???"
    print(f"  Line {line_num+1}: case \"{case_name}\" (~{lines_in_case} lines)")

# Find which cases have orphaned code
# A case should have either:
# - return <Component ...>; directly after it
# - OR return ( ... ); spanning multiple lines
#  
# If it has JSX without return, that's orphaned

orphaned_cases = []
for idx in range(len(cases)):
    line_num, case_name, _ = cases[idx]
    next_line_idx = line_num + 1
    
    if next_line_idx < len(lines):
        next_line = lines[next_line_idx].strip()
        # Check if it's a proper return or orphaned JSX
        if next_line.startswith("return "):
            # Valid case
            pass
        elif next_line.startswith("<"):
            # Orphaned JSX at the start
            orphaned_cases.append((idx, line_num, case_name))
            print(f"  ❌ Line {line_num+1}: case \"{case_name}\" has orphaned code")

# If we found orphaned cases, remove ALL of them iteratively
# Strategy: Find cases with orphaned code and delete from them until the next valid case
if orphaned_cases:
    print(f"\n⚠ Found {len(orphaned_cases)} orphaned cases to clean up")
    
    # Process from the LAST orphaned case backwards to avoid index shifting
    for orphaned_num, (orphaned_idx, orphaned_line, orphaned_name) in enumerate(reversed(orphaned_cases)):
        # Re-calculate indices because we're modifying the list
        print(f"\nProcessing orphaned case #{orphaned_num+1}: {orphaned_name}")
        
        # Find the NEXT case after this orphaned one
        next_case_idx = None
        for i in range(orphaned_idx + 1, len(cases)):
            next_case_idx = i
            break
        
        if next_case_idx is not None:
            next_case_line = cases[next_case_idx][0]
            
            # Since we're reversing, we need to account for earlier deletions
            # Just use the current line number from the cases array
            print(f"  Deleting orphaned code from line {orphaned_line+1} to {next_case_line}")
            del lines[orphaned_line:next_case_line]
            
            # Update cases list by removing the deleted cases
            # Find how many case entries were deleted
            deleted_cases = [c for c in cases if orphaned_line <= c[0] < next_case_line]
            for deleted_case in deleted_cases:
                cases.remove(deleted_case)
            
            print(f"  ✓ Deleted {next_case_line - orphaned_line} lines")
        else:
            print(f"  ⚠ Could not find next case")
    
    # Write back
    with open(r"d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx", "w") as f:
        f.writelines(lines)
    
    print(f"\n✓ File fixed! Removed all orphaned cases")
