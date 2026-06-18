const fs = require('fs');
const content = fs.readFileSync('src/app/tenant-admin/sections/expenses-modals.tsx', 'utf-8');
const tagRegex = /<(input|select|textarea)\b([\s\S]*?)>/gi;
let m;
let count = 0;
while ((m = tagRegex.exec(content)) !== null) {
  const inner = m[2];
  const tplMatch = inner.match(/className=\{`([\s\S]*?)`\}/);
  if (tplMatch) {
    count++;
    console.log('Found template literal className:', tplMatch[1].substring(0, 60) + '...');
  }
}
console.log('Total template literal matches:', count);
