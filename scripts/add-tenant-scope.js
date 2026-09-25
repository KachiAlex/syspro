/**
 * Codemod: insert requireTenantScope() at the top of every exported HTTP
 * handler in route files that have no auth check. Only touches handlers whose
 * first param is named `request` or `req` (not `_`-prefixed unused params).
 */
const fs = require("fs");
const path = require("path");

const SKIP = new Set([
  "src/app/api/apply/route.ts",
  "src/app/api/employee-lookup/route.ts",
  "src/app/api/hr/resumes/parse/route.ts",
  "src/app/api/itsupport/[...path]/route.ts",
  "src/app/api/superadmin/setup/route.ts",
  "src/app/api/superadmin/auth/logout/route.ts",
]);

const files = process.argv.slice(2);
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function findMatchingParen(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function findMatchingBrace(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function transform(src) {
  // Match handler declarations
  const re = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(\s*(\w+)/g;
  const inserts = [];
  let m;
  while ((m = re.exec(src))) {
    const paramName = m[2];
    if (paramName.startsWith("_") || (paramName !== "request" && paramName !== "req")) continue;
    // find close paren of params, then the opening brace of the body
    const closeParen = findMatchingParen(src, re.lastIndex - paramName.length - 1);
    // actually find the '(' position: re.lastIndex - paramName.length points at param name; scan back for '('
    const openParenIdx = src.indexOf("(", m.index + m[0].indexOf("("));
    const cp = findMatchingParen(src, openParenIdx);
    if (cp === -1) continue;
    // optional return type annotation, then '{'
    let j = cp + 1;
    while (j < src.length && /\s/.test(src[j])) j++;
    if (src[j] === ":") {
      // skip return type until '{'
      while (j < src.length && src[j] !== "{") j++;
    }
    if (src[j] !== "{") continue;
    inserts.push({ pos: j + 1, paramName });
  }
  if (!inserts.length) return { src, count: 0 };

  // Apply insertions back-to-front
  let out = src;
  for (const ins of inserts.sort((a, b) => b.pos - a.pos)) {
    const code = `\n    const _scope = await requireTenantScope(${ins.paramName});\n    if (!_scope.ok) return _scope.response;\n`;
    out = out.slice(0, ins.pos) + code + out.slice(ins.pos);
  }

  // Add import after last import statement
  if (!out.includes('from "@/lib/api-auth"') && !out.includes("from '@/lib/api-auth'")) {
    const importRe = /^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm;
    let last = null;
    while ((m = importRe.exec(out))) last = m;
    if (last) {
      const insertAt = last.index + last[0].length;
      out = out.slice(0, insertAt) + `\nimport { requireTenantScope } from "@/lib/api-auth";` + out.slice(insertAt);
    }
  } else if (!/requireTenantScope/.test(out.match(/import[^;]*api-auth[^;]*;/)?.[0] || "")) {
    // api-auth already imported — add the named import
    out = out.replace(/import\s*\{([^}]*)\}\s*from\s*["']@\/lib\/api-auth["'];/, (s, names) =>
      `import {${names.trimEnd()}, requireTenantScope } from "@/lib/api-auth";`
    );
  }
  return { src: out, count: inserts.length };
}

for (const rel of files) {
  if (SKIP.has(rel)) { console.log("SKIP", rel); continue; }
  const src = fs.readFileSync(rel, "utf8");
  const { src: out, count } = transform(src);
  if (count === 0) { console.log("NOOP", rel); continue; }
  fs.writeFileSync(rel, out);
  console.log(`PATCHED ${rel} (+${count} handlers)`);
}
