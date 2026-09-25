// Post-check: flag `const X = useCallback(` declarations at brace depth > 1
// (likely landed inside a nested block = conditional hook violation).
const fs = require('fs');
const { execSync } = require('child_process');

function maskCode(src) {
  const a = src.split('');
  let i = 0, inLine = false, inBlock = false;
  while (i < a.length) {
    const c = a[i], n = a[i + 1];
    if (inLine) { if (c === '\n') inLine = false; else a[i] = ' '; i++; continue; }
    if (inBlock) { if (c === '*' && n === '/') { a[i] = a[i + 1] = ' '; i += 2; inBlock = false; } else { if (c !== '\n') a[i] = ' '; i++; } continue; }
    if (c === '/' && n === '/') { inLine = true; a[i] = a[i + 1] = ' '; i += 2; continue; }
    if (c === '/' && n === '*') { inBlock = true; a[i] = a[i + 1] = ' '; i += 2; continue; }
    if (c === '"' || c === "'") {
      a[i] = ' '; i++;
      while (i < a.length && a[i] !== c) {
        if (a[i] === '\\') { a[i] = ' '; a[i + 1] = ' '; i += 2; continue; }
        if (a[i] !== '\n') a[i] = ' '; i++;
      }
      if (i < a.length) a[i] = ' ';
      i++; continue;
    }
    if (c === '`') {
      a[i] = ' '; i++;
      while (i < a.length && a[i] !== '`') {
        if (a[i] === '\\') { a[i] = ' '; a[i + 1] = ' '; i += 2; continue; }
        if (a[i] === '$' && a[i + 1] === '{') { i += 2; continue; }
        if (a[i] !== '\n') a[i] = ' '; i++;
      }
      if (i < a.length) a[i] = ' ';
      i++; continue;
    }
    i++;
  }
  return a.join('');
}
function depthAt(m, pos) {
  let d = 0;
  for (let i = 0; i < pos; i++) {
    if (m[i] === '{') d++;
    else if (m[i] === '}') d--;
  }
  return d;
}
const files = execSync('git diff --name-only', { encoding: 'utf8' })
  .split('\n').filter(f => f.endsWith('.tsx'));
for (const f of files) {
  let src;
  try { src = fs.readFileSync(f, 'utf8'); } catch { continue; }
  const masked = maskCode(src);
  for (const m of src.matchAll(/const\s+\w+\s*=\s*useCallback\(/g)) {
    const d = depthAt(masked, m.index);
    if (d > 1) {
      const line = src.slice(0, m.index).split('\n').length;
      console.log(`SUSPECT depth=${d} ${f}:${line}`);
    }
  }
}
console.log('done');
