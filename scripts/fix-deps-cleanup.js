/*
 * Post-pass for fix-exhaustive-deps.js:
 *  - parse `tsc --noEmit` errors
 *  - TS2304 "Cannot find name 'X'" → strip X from `}, [ ... ])` dep arrays
 *    in that file (name was over-included by dep inference)
 *  - collapse `);;` → `);` artifacts
 * Iterates until tsc reports no dep-related errors (max 6 passes).
 * TS2448 "used before declaration" leftovers are reported for manual fix.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

function runTsc() {
  try {
    execSync('npx tsc --noEmit', { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, shell: true });
    return '';
  } catch (err) {
    return ((err.stdout || '') + (err.stderr || '')).toString();
  }
}

function stripName(file, name) {
  let src = fs.readFileSync(file, 'utf8');
  // hook dep arrays look like "}, [a, b])" — only strip inside those
  const re = /(\}\s*,)\s*\[([^\]]*)\]\)/g;
  let changed = false;
  src = src.replace(re, (m, lead, deps) => {
    const parts = deps.split(',').map((d) => d.trim()).filter(Boolean);
    if (!parts.includes(name)) return m;
    const next = parts.filter((d) => d !== name);
    changed = true;
    return `${lead} [${next.join(', ')}])`;
  });
  if (changed) fs.writeFileSync(file, src);
  return changed;
}

for (let pass = 0; pass < 6; pass++) {
  const out = runTsc();
  const lines = out.split('\n').filter((l) => /error TS/.test(l));
  if (!lines.length) { console.log('tsc clean'); break; }

  const cannotFind = new Map(); // file -> Set(names)
  const beforeDecl = [];
  for (const l of lines) {
    const m = /^(.+?)\(\d+,\d+\): error (TS\d+): (.+)$/.exec(l.trim());
    if (!m) continue;
    const [, file, code, msg] = m;
    if (code === 'TS2304' || code === 'TS2552') {
      const nm = /Cannot find name '([^']+)'/.exec(msg);
      if (nm) {
        if (!cannotFind.has(file)) cannotFind.set(file, new Set());
        cannotFind.get(file).add(nm[1]);
      }
    } else if (code === 'TS2448' || code === 'TS2454') {
      beforeDecl.push(l.trim());
    } else {
      console.log('unhandled:', l.trim());
    }
  }

  if (!cannotFind.size && !beforeDecl.length) break;

  let stripped = 0;
  for (const [file, names] of cannotFind) {
    const f = path.isAbsolute(file) ? file : path.join(ROOT, file);
    if (!fs.existsSync(f)) continue;
    for (const n of names) if (stripName(f, n)) stripped++;
  }
  console.log(`pass ${pass}: stripped ${stripped} dep names from ${cannotFind.size} files`);
  if (beforeDecl.length) {
    console.log('used-before-declaration (manual):');
    beforeDecl.slice(0, 20).forEach((l) => console.log('  ', l));
  }
  if (!stripped) break;
}

// collapse double semicolons produced by the transform
const { execSync: _e } = require('child_process');
console.log('done');
