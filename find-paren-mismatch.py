#!/usr/bin/env python3
"""Find the paren mismatch by checking all lines"""

with open(r"d:\Syspro\syspro-erp-frontend\src\app\tenant-admin\page.tsx", "r") as f:
    lines = f.readlines()

# Start from line 1 and count
paren_count = 0
stack = []  # Track opening parens for debugging

# Check from accounting start (line 848) onwards  
start_line = 847  
for i in range(start_line, 1191):
    line = lines[i]
    line_num = i + 1
    
    for j, c in enumerate(line):
        if c == '(':
            paren_count += 1
            stack.append((line_num, j+1, c))
        elif c == ')':
            paren_count -= 1
            if paren_count < 0:
                print(f"❌ EXTRA CLOSING PAREN at line {line_num}, col {j+1}")
                print(f"   Line: {line.rstrip()}")
                if stack:
                    last_open = stack[-1]
                    print(f"   Last opening paren was at line {last_open[0]}, col {last_open[1]}")
                    print(f"   Context for last open: {lines[last_open[0]-1].rstrip()}")
                print(f"   Current paren count: {paren_count}")
                exit(1)
            if stack:
                stack.pop()

print(f"Final paren count: {paren_count}")
if paren_count >0:
    print(f"Missing {paren_count} closing parens")
    print(f"Last {min(5, len(stack))} unclosed opens:")
    for loc in stack[-5:]:
        print(f"  Line {loc[0]}, col {loc[1]}: {lines[loc[0]-1].rstrip()}")
elif paren_count < 0:
    print(f"Extra {-paren_count} closing parens")
else:
    print("✓ Parens balanced in accounting case")
