#!/usr/bin/env python3
"""
Remove all orphaned code blocks in switch statement
Orphaned code = code after return statements before the next case/default
"""

import re

with open(r"d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx", "r") as f:
    lines = f.readlines()

# Find the switch statement (line ~216)
switch_start = -1
for i, line in enumerate(lines):
    if 'switch (activeSection)' in line:
        switch_start = i
        break

if switch_start == -1:
    print("Could not find switch(activeSection)")
    exit(1)

# Find end of switch - look for closing brace at proper indentation
switch_end = -1
brace_count = 0
found_start_brace = False

for i in range(switch_start, len(lines)):
    line = lines[i]
    
    # Count braces
    for c in line:
        if c == '{':
            brace_count += 1
            found_start_brace = True
        elif c == '}':
            brace_count -= 1
            if found_start_brace and brace_count == 0:
                switch_end = i
                break
    
    if switch_end > 0:
        break

if switch_end == -1:
    print(f"Could not find end of switch (starting at line {switch_start})")
    exit(1)

print(f"Switch statement from line {switch_start+1} to {switch_end+1}")

# Process lines within switch
out_lines = []
i = switch_start

while i <= switch_end:
    line = lines[i]
    
    # Check if this line has a case statement followed by return
    if re.match(r'\s*case\s+', line):
        out_lines.append(line)
        i += 1
        
        # Collect following lines until we see the return statement
        while i <= switch_end and 'return' not in lines[i]:
            i += 1
        
        if i <= switch_end:
            return_line = lines[i]
            out_lines.append(return_line)
            i += 1
            
            # If return is multi-line (contains opening paren but not semicolon at end)
            if '(' in return_line and not return_line.rstrip().endswith(';'):
                # Collect until statement ends with semicolon
                paren_count = return_line.count('(') - return_line.count(')')
                
                while i <= switch_end and paren_count > 0:
                    next_line = lines[i]
                    out_lines.append(next_line)
                    paren_count += next_line.count('(') - next_line.count(')')
                    
                    # Also check for semicolon (might complete before parens close)
                    if ';' in next_line and paren_count <= 0:
                        i += 1
                        break
                    
                    i += 1
            
            # Skip any orphaned code until next case, default, or switch end
            start_orphan = i
            while i <= switch_end and not re.match(r'\s*(case\s+|default\s*:|}\s*$)', lines[i]):
                # Skip this orphaned line
                i += 1
            
            if i > start_orphan:
                print(f"Removed {i - start_orphan} orphaned lines after return at line {return_line.strip()[:50]}")
    
    elif re.match(r'\s*(default\s*:|}\s*)', line):
        # Copy default case and closing braces
        out_lines.append(line)
        i += 1
    else:
        # Other lines (spacing, comments before case)
        out_lines.append(line)
        i += 1

# Reconstruct file
new_content = ''.join(lines[:switch_start]) + ''.join(out_lines) + ''.join(lines[switch_end+1:])

with open(r"d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx", "w") as f:
    f.write(new_content)

print("✓ Cleanup complete!")
