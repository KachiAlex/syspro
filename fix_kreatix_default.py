import os, re

patterns = [
    r'\?\?\s*"kreatix-default"',
    r'\|\|\s*"kreatix-default"',
    r"\?\?\s*'kreatix-default'",
    r"\|\|\s*'kreatix-default'",
]

def process_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    orig = content
    for p in patterns:
        content = re.sub(p, '', content)
    if content != orig:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

roots = [
    'c:/syspro/src/app/crm',
    'c:/syspro/src/app/tenant-admin/sections',
    'c:/syspro/src/app/tenant-admin',
    'c:/syspro/src/lib',
    'c:/syspro/src/app/access',
]

changed = []
for root in roots:
    for dirpath, dirnames, filenames in os.walk(root):
        for fn in filenames:
            if fn.endswith(('.ts', '.tsx')):
                fp = os.path.join(dirpath, fn)
                if process_file(fp):
                    changed.append(fp)

print(f'Changed {len(changed)} files:')
for c in changed[:20]:
    print(c)
if len(changed) > 20:
    print(f'... and {len(changed)-20} more')
