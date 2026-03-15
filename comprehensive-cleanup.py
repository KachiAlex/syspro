#!/usr/bin/env python3
"""
Comprehensive cleanup of tenant-admin/page.tsx
Removes all orphaned code after return statements within case blocks
"""

import re

with open(r"d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx", "r") as f:
    content = f.read()

# Find the switch statement start (after line with "switch(activeModule)")
switch_start = content.find('switch (activeModule) {')
if switch_start == -1:
    print("Could not find switch statement")
    exit(1)

# Find the switch statement end (closing brace for switch)
switch_end = -1
brace_count = 0
in_switch = False
for i in range(switch_start, len(content)):
    if content[i] == '{':
        if not in_switch:
            in_switch = True
        brace_count += 1
    elif content[i] == '}':
        brace_count -= 1
        if in_switch and brace_count == 0:
            switch_end = i + 1
            break

if switch_end == -1:
    print("Could not find end of switch statement")
    exit(1)

switch_block = content[switch_start:switch_end]

# Pattern: case "something": followed by return statement
# We need to keep only: case "name": return <Component>; or case "name": return (...)
# And remove everything after each valid return until we hit the next case or default or end

# Split into lines for easier processing
lines = switch_block.split('\n')
cleaned_lines = []
i = 0

while i < len(lines):
    line = lines[i]
    
    # Check if this is a case line
    if re.match(r'\s*case\s+"[^"]+"\s*:', line):
        cleaned_lines.append(line)
        i += 1
        
        # Next line should be a return statement
        if i < len(lines):
            next_line = lines[i]
            if 'return' in next_line:
                # This is a simple return like: return <Component />;
                if ';' in next_line or (next_line.strip().endswith('>') and '>' in next_line and '<' in next_line and '/' in next_line):
                    # Single line return
                    cleaned_lines.append(next_line)
                    i += 1
                elif '(' in next_line and '(' not in lines[i-1]:
                    # Multi-line return statement starts with (
                    cleaned_lines.append(next_line)
                    i += 1
                    paren_count = next_line.count('(') - next_line.count(')')
                    
                    # Collect until parens are balanced
                    while i < len(lines) and paren_count > 0:
                        next_line = lines[i]
                        cleaned_lines.append(next_line)
                        paren_count += next_line.count('(') - next_line.count(')')
                        i += 1
                else:
                    cleaned_lines.append(next_line)
                    i += 1
            else:
                # Weird, no return after case - skip this line
                i += 1
    elif re.match(r'\s*case\s+["\']default["\']?\s*:', line) or re.match(r'\s*default\s*:', line):
        # Default case - keep it and everything until end
        cleaned_lines.append(line)
        i += 1
        # Collect the rest for default
        while i < len(lines):
            cleaned_lines.append(lines[i])
            i += 1
    else:
        # Not a case line - skip it (this removes orphaned code)
        i += 1

# Reconstruct the switch block
cleaned_switch = '\n'.join(cleaned_lines)

# Replace in original content
new_content = content[:switch_start] + cleaned_switch + content[switch_end:]

# Write back
with open(r"d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx", "w") as f:
    f.write(new_content)

# Count what was removed
diff = len(switch_block) - len(cleaned_switch)
print(f"✓ Removed {diff} characters of orphaned code")
print(f"Original switch block: {len(switch_block)} chars")
print(f"Cleaned switch block: {len(cleaned_switch)} chars")
