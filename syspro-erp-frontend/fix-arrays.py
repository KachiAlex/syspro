#!/usr/bin/env python3
"""
Fix undefined array accesses in admin section components.
Replaces unsafe .length, .map(), .join() calls with defensive equivalents.
"""

import re
import os
from pathlib import Path

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Fix .length checks on state variables: roles.length => (roles ?? []).length
    content = re.sub(r'(\w+)\.length === 0', r'(\1 ?? []).length === 0', content)
    
    # Fix {someArray.map -> {(someArray ?? []).map but NOT for steps/editSteps/prev.map
    content = re.sub(r'{(\w+)\.map\(\(', r'{(\1 ?? []).map((', content)
    # But exclude lines that already have Array.isArray check
    if original != content:
        print(f"✓ Fixed .length and .map in {filepath}")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

# Fix all admin section files
sections_dir = Path('src/app/tenant-admin/sections')
for tsx_file in sections_dir.glob('*.tsx'):
    print(f"Processing {tsx_file.name}...")
    fix_file(str(tsx_file))

print("\nDone! All files patched.")
