#!/usr/bin/env python3
"""
SAFE cleanup: Only edit inside the switch statement, preserve imports
Strategy: Keep all code until we find "switch (activeSection)"
Then process cases carefully
"""

with open(r"d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx", "r") as f:
    content = f.read()

# Find where the switch statement is
switch_pattern = "switch (activeSection) {"
switch_idx = content.find(switch_pattern)

if switch_idx == -1:
    print("ERROR: Could not find switch statement")
    exit(1)

# Keep everything before the switch
before_switch = content[:switch_idx + len(switch_pattern)]

# Extract the content after switch opening brace
after_switch_start = switch_idx + len(switch_pattern)
after_content = content[after_switch_start:]

# Find the closing brace of the switch (last brace at indentation level 0 relative to switch)
# Look for the pattern "    }" which closes the renderContent function after the switch
lines = after_content.split('\n')
output_lines = []
i = 0

while i < len(lines):
    line = lines[i]
    
    # If we find a line that's just "    }" at the function level, we're done
    if line.strip() == '}' and i > 100:  # After enough function content
        output_lines.append(line)
        i += 1
        # The rest is after the switch
        break
    
    # Look for case statements
    if 'case "' in line and ':' in line:
        output_lines.append(line)
        i += 1
        
        # Next line(s) should be the return statement
        # Collect lines until we hit the next case or default
        while i < len(lines):
            next_line = lines[i]
            
            # Check for next case or default
            if ('case "' in next_line and ':' in next_line) or next_line.strip().startswith('default'):
                # Don't consume this line - loop will handle it
                break
            
            # This is part of the return or orphaned code
            if 'return' in next_line:
                # Start collecting the return statement
                output_lines.append(next_line)
                i += 1
                
                # If multi-line, collect until completion
                if '(' in next_line:
                    paren_count = next_line.count('(') - next_line.count(')')
                    while i < len(lines) and paren_count > 0:
                        next_line = lines[i]
                        output_lines.append(next_line)
                        paren_count += next_line.count('(') - next_line.count(')')
                        i += 1
                
                # Now skip ALL orphaned lines until next case
                while i < len(lines):
                    check_line = lines[i]
                    if ('case "' in check_line and ':' in check_line) or check_line.strip().startswith('default'):
                        break
                    i += 1
                break
            else:
                # Orphaned line - skip it
                i += 1
    
    elif line.strip().startswith('default'):
        # Copy default case and rest
        output_lines.append(line)
        i += 1
        # Copy until we find the closing brace
        while i < len(lines):
            next_line = lines[i]
            output_lines.append(next_line)
            if next_line.strip() == '}':
                break
            i += 1
        break
    
    else:
        # Blank lines or comments between cases
        if line.strip() == '' or line.strip().startswith('//'):
            output_lines.append(line)
        i += 1

# Reconstruct
fixed_switch_content = '\n'.join(output_lines)

# Everything after the switch
rest_of_file = '\n'.join(lines[i:]) if i < len(lines) else ''

new_content = before_switch + '\n' + fixed_switch_content + rest_of_file

with open(r"d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx", "w") as f:
    f.write(new_content)

print("✓ Safe cleanup complete")
print(f"  Preserved imports and function structure")
print(f"  Removed orphaned code between case statements")
