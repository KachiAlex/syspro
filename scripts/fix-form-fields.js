const fs = require('fs');
const path = require('path');

function findFiles(dir, ext, files = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      findFiles(full, ext, files);
    } else if (full.endsWith(ext)) {
      files.push(full);
    }
  }
  return files;
}

const darkBgs = [
  'bg-[#0B1120]', 'bg-[#111827]', 'bg-slate-50', 'bg-slate-100',
  'bg-gray-50', 'bg-gray-100', 'bg-gray-200', 'bg-slate-200',
  'bg-slate-300', 'bg-gray-300', 'bg-white/10', 'bg-white/5'
];

const darkTexts = [
  'text-[#F8FAFC]', 'text-[#94A3B8]', 'text-[#64748B]',
  'text-gray-700', 'text-gray-600', 'text-gray-500',
  'text-slate-700', 'text-slate-600', 'text-slate-500',
  'text-slate-800', 'text-gray-800', 'text-gray-900', 'text-slate-900'
];

function fixClassNameValue(c) {
  let cls = c;
  for (const db of darkBgs) { cls = cls.split(db).join('bg-white'); }
  for (const dt of darkTexts) { cls = cls.split(dt).join('text-black'); }
  if (!/\bbg-(white|transparent|none|opacity-|black\/)/.test(cls) && !cls.includes('bg-[')) {
    if (!cls.includes('bg-white')) cls = 'bg-white ' + cls;
  }
  if (!/\btext-(black|white|transparent|center|right|left|justify|sm|base|lg|xl|2xl|xs|red-|green-|blue-|amber-|indigo-|purple-|pink-|yellow-)/.test(cls) && !cls.includes('text-[')) {
    if (!cls.includes('text-black')) cls = cls + ' text-black';
  }
  cls = cls.replace(/\s+/g, ' ').trim();
  return cls;
}

const dir = path.resolve(__dirname, '../src/app/tenant-admin/sections');
const files = findFiles(dir, '.tsx');

let totalChanges = 0;

for (const file of files) {
  const lines = fs.readFileSync(file, 'utf-8').split('\n');
  let changed = false;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(/^(\s*)<(input|select|textarea)\b/);
    if (match) {
      const indent = match[1];
      const tagName = match[2];
      // Collect tag lines until we find the closing >
      let tagLines = [line];
      let j = i + 1;
      let tagEndFound = false;
      const currentTrimmed = line.trim();
      if ((currentTrimmed.endsWith('>') || currentTrimmed.endsWith('/>')) && !currentTrimmed.endsWith('=>')) {
        tagEndFound = true;
        j = i; // single-line tag: only replace current line
      } else {
        while (j < lines.length) {
          tagLines.push(lines[j]);
          const lastLine = lines[j].trim();
          if ((lastLine.endsWith('>') || lastLine.endsWith('/>')) && !lastLine.endsWith('=>')) {
            tagEndFound = true;
            break;
          }
          j++;
        }
      }

      if (tagEndFound) {
        let tagText = tagLines.join('\n');
        let modified = false;

        // Case 1: className="..."
        const strMatch = tagText.match(/className="([^"]*)"/);
        if (strMatch) {
          const oldCls = strMatch[1];
          const newCls = fixClassNameValue(oldCls);
          if (newCls !== oldCls) {
            tagText = tagText.replace(`className="${oldCls}"`, `className="${newCls}"`);
            modified = true;
          }
        }

        // Case 2: className={`...`}
        // Find the className={`...`} within the tag
        const tplRegex = /className=\{`([\s\S]*?)`\}/;
        const tplMatch = tagText.match(tplRegex);
        if (tplMatch) {
          const oldCls = tplMatch[1];
          const newCls = fixClassNameValue(oldCls);
          if (newCls !== oldCls) {
            tagText = tagText.replace(`className={\`${oldCls}\`}`, `className={\`${newCls}\`}`);
            modified = true;
          }
        }

        if (modified) {
          const newLines = tagText.split('\n');
          lines.splice(i, j - i + 1, ...newLines);
          changed = true;
          totalChanges++;
          i += newLines.length;
          continue;
        } else {
          i = j + 1;
          continue;
        }
      }
    }
    i++;
  }

  if (changed) {
    fs.writeFileSync(file, lines.join('\n'), 'utf-8');
    console.log('Updated:', path.relative(process.cwd(), file));
  }
}

console.log('Total tags modified:', totalChanges);
