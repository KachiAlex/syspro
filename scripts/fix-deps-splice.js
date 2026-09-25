// Pass 2: for each exhaustive-deps warning in patched files, splice missing
// deps into the dep array or remove unnecessary ones.
const fs = require('fs');
const { execSync } = require('child_process');

const files = execSync('git diff --name-only', { encoding: 'utf8' })
  .split('\n').map(s => s.trim()).filter(f => f.endsWith('.tsx'));

const changed = [];
for (const file of files) {
  let out;
  try {
    out = execSync(`npx eslint --no-eslintrc -c .eslintrc.json --format unix "${file}"`, { encoding: 'utf8' });
  } catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  const warns = [];
  for (const line of out.split('\n')) {
    // unix format: file:line:col: message [rule]
    const m = line.match(/:(\d+):(\d+):\s+(.*)\[(?:Warning\/)?react-hooks\/exhaustive-deps\]/);
    if (m) warns.push({ line: +m[1], col: +m[2], msg: m[3] });
  }
  if (!warns.length) continue;
  let src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  // Process bottom-up so line numbers stay valid
  for (const w of warns.sort((a, b) => b.line - a.line)) {
    const li = w.line - 1;
    const text = lines[li];
    // find the dep array '[' at/after col
    const openIdx = text.indexOf('[', w.col - 1);
    if (openIdx === -1) { console.log(`skip (no [ on line) ${file}:${w.line}`); continue; }
    const closeIdx = text.indexOf(']', openIdx);
    if (closeIdx === -1) { console.log(`skip (no ] on line) ${file}:${w.line}`); continue; }
    const depsStr = text.slice(openIdx + 1, closeIdx);
    const deps = depsStr.split(',').map(s => s.trim()).filter(Boolean);

    let missing = [];
    const mm = w.msg.match(/missing dependenc(?:y|ies):\s*([^.\[]+?)(?:\.\s|\s+Either|\s+or\s|$)/i);
    if (mm) {
      missing = [...mm[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
      // member deps like perms.crm -> root ident; reports.length -> reports
      missing = missing.map(n => n.split('.')[0]);
    }
    let unnecessary = [];
    const um = w.msg.match(/unnecessary dependenc(?:y|ies):\s*([^.\[]+?)(?:\.\s|\s+Either|\s+or\s|$)/i);
    if (um) unnecessary = [...um[1].matchAll(/'([^']+)'/g)].map(x => x[1]);

    if (!missing.length && !unnecessary.length) { console.log(`unparsed ${file}:${w.line}: ${w.msg.slice(0, 90)}`); continue; }

    let next = deps.filter(d => !unnecessary.includes(d));
    for (const n of missing) if (!next.includes(n)) next.push(n);
    // alphabetical-ish: keep order but stable
    const newDeps = `[${next.join(', ')}]`;
    lines[li] = text.slice(0, openIdx) + newDeps + text.slice(closeIdx + 1);
    console.log(`${file}:${w.line} deps -> ${newDeps}`);
  }
  fs.writeFileSync(file, lines.join('\n'));
  changed.push(file);
}
console.log(`files touched: ${changed.length}`);
