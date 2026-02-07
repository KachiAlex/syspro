#!/usr/bin/env python3
"""
Add defensive error handling to load() functions in all admin sections.
"""

import re
from pathlib import Path

def fix_load_function(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Fix load() error handling: parse JSON before checking res.ok
    pattern = r'(async function load\(\) \{[\s\S]*?try \{[\s\S]*?const res = await fetch[^;]+;)\s*(if \(!res\.ok\) throw new Error)'
    
    def replace_load(match):
        prefix = match.group(1)
        condition = match.group(2)
        # Insert JSON parse before the condition
        return prefix + '\n      const payload = await res.json().catch(() => ({}));\n      ' + condition
    
    content = re.sub(pattern, replace_load, content)
    
    # Also fix where JSON is parsed AFTER ok check - swap the order
    pattern2 = r'(const res = await fetch[^;]+;)\s*(if \(!res\.ok\) throw new Error[^;]+;)\s*(const payload = await res\.json\(\))'
    
    def replace_order(match):
        fetch_line = match.group(1)
        ok_check = match.group(2)
        json_parse = match.group(3)
        # Move JSON parse before check
        return fetch_line + '\n      const payload = await res.json().catch(() => ({}));\n      if (!res.ok) {\n        setRoles([]);\n        setError(payload?.error ?? "Failed to load");\n        return;\n      }\n      // ' + json_parse
    
    new_content = re.sub(pattern2, replace_order, content)
    
    if original != content or original != new_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content if new_content != content else content)
        return True
    return False

# Fix all files
for tsx_file in Path('src/app/tenant-admin/sections').glob('*.tsx'):
    if fix_load_function(str(tsx_file)):
        print(f"✓ Enhanced error handling in {tsx_file.name}")

print("Error handling fixes applied!")
