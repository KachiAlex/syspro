/*
 * Fix react-hooks/exhaustive-deps warnings for the dominant pattern:
 *
 *   async function load() { ...reads reactive values... }
 *   useEffect(() => { load(); }, [deps]);
 *
 * Transform:
 *   const load = useCallback(async () => { ... }, [depsOfLoad]);
 *   useEffect(() => { load(); }, [load, ...depsReadDirectlyByEffect]);
 *
 * depsOfLoad = identifiers used in fn body that are component-scope reactive
 * values (useState slots, useMemo/useCallback results, props), excluding
 * setters, member accesses (json.reports) and object-literal keys.
 *
 * eslint is the oracle for residuals (plain consts, refs, etc.).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// ── collect warnings via eslint --format json ──────────────────────────────
let raw;
try {
  raw = execSync('npx eslint src/ --format json', {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: true,
  }).toString();
} catch (err) {
  raw = (err.stdout || '').toString();
}
const results = JSON.parse(raw);

const warningsByFile = new Map();
for (const file of results) {
  const list = file.messages.filter(
    (m) => m.ruleId === 'react-hooks/exhaustive-deps'
  );
  if (list.length) warningsByFile.set(file.filePath, list);
}

// ── helpers ────────────────────────────────────────────────────────────────
function matchBrace(src, openIdx) {
  let depth = 0, inStr = null, inLine = false, inBlock = false;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (inLine) { if (c === '\n') inLine = false; continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }
    if (inStr) { if (c === '\\') i++; else if (c === inStr) inStr = null; continue; }
    if (c === '/' && n === '/') { inLine = true; continue; }
    if (c === '/' && n === '*') { inBlock = true; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// All component-scope reactive names: useState/useMemo/useReducer/useRef slots,
// use*() destructures, function-component prop destructures.
function findDeclaredReactives(src) {
  const names = new Set();
  for (const m of src.matchAll(/const\s*\[\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\]\s*=\s*use(?:State|Memo|Reducer|Ref|Callback)/g)) {
    names.add(m[1]);
    if (/use(?:Reducer|Ref)/.test(m[0])) names.add(m[2]); // reducer dispatch is stable; ref object too, but harmless
  }
  for (const m of src.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*use(?:Memo|Callback|Ref|Context|Reducer|SyncExternalStore)[\w]*\s*\(/g)) {
    names.add(m[1]);
  }
  for (const m of src.matchAll(/const\s*\{\s*([^}]+)\}\s*=\s*use[A-Z][\w]*\s*\(/g)) {
    for (const p of m[1].split(',')) {
      const name = p.trim().split(':').pop().split('=')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  for (const m of src.matchAll(/(?:function\s+[A-Za-z_$][\w$]*|=>\s*|\()\s*\{\s*([^}]*)\}\s*(?::[^)]*)?\)/g)) {
    for (const p of m[1].split(',')) {
      const name = p.trim().split(':')[0].split('=')[0].trim().replace(/^\.\.\./, '');
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name);
    }
  }
  return names;
}

// remove string literal contents; keep ${...} expressions from templates
function stripStrings(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'") {
      const end = skipQuoted(src, i, c);
      out += ' ';
      i = end;
    } else if (c === '`') {
      // template: scan segments, keep only ${...} contents
      i++;
      while (i < src.length && src[i] !== '`') {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '$' && src[i + 1] === '{') {
          const close = matchBrace(src, i + 1);
          if (close < 0) break;
          out += ' ' + src.slice(i + 2, close) + ' ';
          i = close + 1;
        } else i++;
      }
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function skipQuoted(src, i, q) {
  i++;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === q) return i + 1;
    i++;
  }
  return i;
}

// identifiers used as VALUES in body: exclude string contents, comments,
// member accesses, object keys, destructuring-target property names.
function bodyIdentifiers(body) {
  const clean = stripStrings(body)
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  const ids = new Set();
  const memberOrKey = new Set();
  for (const m of clean.matchAll(/\.\s*([A-Za-z_$][\w$]*)/g)) memberOrKey.add(m[1]);
  for (const m of clean.matchAll(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g)) memberOrKey.add(m[2]);
  for (const m of clean.matchAll(/\{\s*([^}]*)\}\s*=/g)) {
    for (const p of m[1].split(',')) memberOrKey.add(p.trim().split(':')[0].trim());
  }
  for (const m of clean.matchAll(/[A-Za-z_$][\w$]*/g)) {
    if (!memberOrKey.has(m[0])) ids.add(m[0]);
  }
  return ids;
}

// Mask strings + comments to spaces (preserving length) so brace depth is accurate.
// Template ${...} segments keep their contents (self-balancing braces).
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
      while (i < a.length && a[i] !== c) { if (a[i] === '\\') { a[i] = ' '; a[i + 1] = ' '; i += 2; continue; } if (a[i] !== '\n') a[i] = ' '; i++; }
      if (i < a.length) a[i] = ' ';
      i++; continue;
    }
    if (c === '`') {
      a[i] = ' '; i++;
      while (i < a.length && a[i] !== '`') {
        if (a[i] === '\\') { a[i] = ' '; a[i + 1] = ' '; i += 2; continue; }
        if (a[i] === '$' && a[i + 1] === '{') { i += 2; continue; } // keep ${} contents
        if (a[i] !== '\n') a[i] = ' ';
        i++;
      }
      if (i < a.length) a[i] = ' ';
      i++; continue;
    }
    i++;
  }
  return a.join('');
}

// depth (brace balance) at position, using masked source
function depthAt(masked, pos) {
  let d = 0;
  for (let i = 0; i < pos; i++) {
    if (masked[i] === '{') d++;
    else if (masked[i] === '}') d--;
  }
  return d;
}

// line-start offsets in file
function lineStarts(src) {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);
  return starts;
}

let filesFixed = 0;
const skipped = [];
const manualDeps = new Set();

for (const [file, warns] of warningsByFile) {
  let src = fs.readFileSync(file, 'utf8');
  const reactives = findDeclaredReactives(src);
  const wrapped = new Set(); // names this run wrapped in useCallback
  let changed = false;

  for (const w of warns) {
    const allQuoted = [...(w.message || '').matchAll(/'([\w$.]+)'/g)].map((m) => m[1]);
    for (const name of allQuoted) {
      if (name.includes('.')) continue; // property dep — manual
      const fnDecl = new RegExp(
        `(\\n|^)([ \\t]*)((?:async\\s+)?function\\s+${name}\\s*\\(|const\\s+${name}\\s*=\\s*(?:async\\s*)?\\()`
      ).exec(src);
      if (!fnDecl) continue;

      const declStart = fnDecl.index + fnDecl[1].length;
      const rest = src.slice(declStart);
      let openParen, newDecl;
      const fm = /^[ \t]*((?:async[ \t]+)?function)[ \t]+\w+[ \t]*\(([^)]*)\)[ \t]*/.exec(rest);
      if (fm) {
        openParen = declStart + fm[0].length;
        newDecl = `${fnDecl[2]}const ${name} = useCallback(${fm[1] === 'function' ? '' : 'async '}(${fm[2]}) => `;
        if (/async/.test(fm[1])) newDecl = `${fnDecl[2]}const ${name} = useCallback(async (${fm[2]}) => `;
      } else {
        const am = /^[ \t]*const[ \t]+\w+[ \t]*=[ \t]*(async[ \t]*)?\(([^)]*)\)[ \t]*=>[ \t]*/.exec(rest);
        if (!am) continue;
        openParen = declStart + am[0].length;
        newDecl = `${fnDecl[2]}const ${name} = useCallback(${am[1] || ''}(${am[2]}) => `;
      }
      if (src[openParen] !== '{') continue;
      const closeBrace = matchBrace(src, openParen);
      if (closeBrace < 0) continue;

      const body = src.slice(openParen, closeBrace + 1);
      const ids = bodyIdentifiers(body);
      const deps = [...ids]
        .filter((id) => reactives.has(id) && !/^set[A-Z]/.test(id) && id !== name)
        .sort();
      const depStr = deps.join(', ');

      const stmt = newDecl + body + `, [${depStr}]);`;
      let after = src.slice(closeBrace + 1);
      if (after.startsWith(';')) after = after.slice(1); // drop now-redundant `;`
      const head = src.slice(0, declStart);

      // earliest reference to NAME before its declaration
      const refRe = new RegExp(`\\b${name}\\b`, 'g');
      let earliest = -1;
      let m;
      while ((m = refRe.exec(head))) {
        earliest = earliest < 0 ? m.index : Math.min(earliest, m.index);
      }

      if (earliest >= 0) {
        const masked = maskCode(src);
        const starts = lineStarts(src);
        const declDepth = depthAt(masked, declStart);

        // enclosing sibling-depth statement containing the earliest ref
        let stmtStart = -1;
        for (const s of starts) {
          if (s > earliest) break;
          if (depthAt(masked, s) === declDepth && /^\s*\S/.test(src.slice(s, s + 400))) {
            stmtStart = s;
          }
        }

        const stmtLineEnd = src.indexOf('\n', stmtStart);
        const stmtLine = src.slice(stmtStart, stmtLineEnd < 0 ? undefined : stmtLineEnd);
        const isHookStmt = /^\s*use(?:Effect|Memo|LayoutEffect)\s*\(/.test(stmtLine);

        if (isHookStmt && stmtStart >= 0) {
          // move the effect statement below the (unmoved) const decl —
          // avoids TDZ when deps are declared between the two.
          let stmtEnd = -1;
          for (let i = stmtStart; i < src.length; i++) {
            if (masked[i] === ';' && depthAt(masked, i) === declDepth) { stmtEnd = i + 1; break; }
          }
          if (stmtEnd > 0 && stmtEnd <= declStart) {
            const moved = src.slice(stmtStart, stmtEnd);
            const before = src.slice(0, stmtStart);
            const middle = src.slice(stmtEnd, declStart);
            src = before + middle + stmt + '\n\n' + moved + after;
          } else {
            src = head + stmt + after;
          }
        } else if (stmtStart >= 0) {
          // non-hook earlier ref (e.g. handler fn) — try inserting the const
          // right before that enclosing statement, provided all deps are
          // declared above it; otherwise leave in place (manual follow-up).
          let safe = true;
          let pos = stmtStart;
          for (const dep of deps) {
            const depDecl = new RegExp(
              `\\b(?:const|let|var)\\s+(?:\\[\\s*${dep}\\b|${dep}\\s*=|\\{[^}]*\\b${dep}\\b[^}]*\\}\\s*=)`
            ).exec(src);
            if (depDecl && depDecl.index > pos) { safe = false; break; }
          }
          if (safe) {
            src = src.slice(0, stmtStart) + fnDecl[2] + stmt.trimStart() + '\n\n' + src.slice(stmtStart, declStart) + after;
          } else {
            manualDeps.add(file);
            src = head + stmt + after;
          }
        } else {
          src = head + stmt + after;
        }
      } else {
        src = head + stmt + after;
      }
      wrapped.add(name);
      changed = true;
    }
  }

  if (!changed) { skipped.push(file); continue; }

  // Re-point effects: for each wrapped NAME called in a useEffect body,
  // rebuild that effect's dep array = (direct ids ∩ reactives ∪ wrapped) + NAME.
  const rePoint = () => {
    const effectRe = /useEffect\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{/g;
    let em;
    const ranges = [];
    while ((em = effectRe.exec(src))) {
      const openIdx = src.indexOf('{', em.index);
      const closeIdx = matchBrace(src, openIdx);
      if (closeIdx < 0) break;
      const effBody = src.slice(openIdx, closeIdx + 1);
      const called = [...wrapped].filter((n) => new RegExp(`\\b${n}\\s*\\(`).test(effBody));
      if (!called.length) continue;
      const tail = src.slice(closeIdx + 1, closeIdx + 500);
      const dm = /^\s*,\s*\[([^\]]*)\]\s*\)/.exec(tail);
      if (!dm) continue;
      const ids = bodyIdentifiers(effBody);
      const keep = [...ids].filter(
        (id) => (reactives.has(id) || wrapped.has(id)) && !/^set[A-Z]/.test(id)
      );
      const depSet = new Set([...keep, ...called]);
      ranges.push({
        start: closeIdx + 1 + dm.index,
        end: closeIdx + 1 + dm.index + dm[0].length,
        text: `, [${[...depSet].sort().join(', ')}])`,
      });
    }
    return ranges;
  };
  for (const r of rePoint().reverse()) {
    src = src.slice(0, r.start) + r.text + src.slice(r.end);
  }

  // ensure useCallback import
  if (/useCallback\(/.test(src) && !/import\s*\{[^}]*\buseCallback\b[^}]*\}\s*from\s+["']react["']/.test(src)) {
    if (/import\s*\{([^}]*)\}\s*from\s+["']react["']/.test(src)) {
      src = src.replace(
        /import\s*\{([^}]*)\}\s*from\s+["']react["']/,
        (mm, g) => `import { ${g.trim()}, useCallback } from "react"`
      );
    } else if (/^import React[^\n]*/m.test(src)) {
      src = src.replace(/^(import React[^\n]*)/m, `$1\nimport { useCallback } from "react";`);
    }
  }

  fs.writeFileSync(file, src);
  filesFixed++;
  console.log('patched:', path.relative(ROOT, file), '→', [...wrapped].join(', '));
}

console.log(`\nfiles patched: ${filesFixed}`);
console.log(`skipped (manual): ${skipped.length}`);
skipped.forEach((f) => console.log('  -', path.relative(ROOT, f)));
if (manualDeps.size) {
  console.log('ordering-flagged (check):');
  manualDeps.forEach((f) => console.log('  -', path.relative(ROOT, f)));
}
