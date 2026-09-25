#!/usr/bin/env node
/**
 * One-shot: insert `requireSuperAdmin` guards into superadmin/tenant API routes.
 * Adds the import, then injects a guard as the first statement of every
 * exported HTTP-method handler. Idempotent (skips files already guarded).
 */
const fs = require("fs");

const FILES = [
  "src/app/api/superadmin/accounts/route.ts",
  "src/app/api/superadmin/audit-logs/route.ts",
  "src/app/api/superadmin/license-tiers/route.ts",
  "src/app/api/superadmin/license-tiers/[id]/route.ts",
  "src/app/api/superadmin/licenses/route.ts",
  "src/app/api/superadmin/licenses/[id]/route.ts",
  "src/app/api/superadmin/tenants/admins/route.ts",
  "src/app/api/superadmin/tenants/admins-batch/route.ts",
  "src/app/api/superadmin/tenants/bulk/route.ts",
  "src/app/api/superadmin/tenants/bulk-activate/route.ts",
  "src/app/api/superadmin/tenants/bulk-delete/route.ts",
  "src/app/api/superadmin/tenants/bulk-suspend/route.ts",
  "src/app/api/superadmin/tenants/route.ts",
  "src/app/api/superadmin/tenants/[slug]/activate/route.ts",
  "src/app/api/superadmin/tenants/[slug]/admins/route.ts",
  "src/app/api/superadmin/tenants/[slug]/admins/[id]/route.ts",
  "src/app/api/superadmin/tenants/[slug]/route.ts",
  "src/app/api/superadmin/tenants/[slug]/suspend/route.ts",
  "src/app/api/tenants/route.ts",
  "src/app/api/tenants/[slug]/route.ts",
];

const GUARD = (param) =>
  `\n    const _auth = await requireSuperAdmin(${param});\n    if (!_auth.ok) return _auth.response;\n`;

function findMatchingParen(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function ensureImport(src, spec, name) {
  if (src.includes(spec)) return src;
  const importRe = /^import[\s\S]*?;[ \t]*$/gm;
  let lastEnd = -1;
  let m;
  while ((m = importRe.exec(src)) !== null) lastEnd = m.index + m[0].length;
  const stmt = `\nimport ${name} from "${spec}";`;
  if (lastEnd === -1) return stmt + "\n" + src;
  return src.slice(0, lastEnd) + stmt + src.slice(lastEnd);
}

for (const file of FILES) {
  let src = fs.readFileSync(file, "utf8");
  if (src.includes("requireSuperAdmin")) {
    console.log("skip (already guarded):", file);
    continue;
  }

  // Pre-pass: give no-arg handlers a request param so the guard has input
  src = src.replace(
    /export async function (GET|POST|PUT|PATCH|DELETE|HEAD)\s*\(\s*\)/g,
    "export async function $1(request: NextRequest)"
  );

  // Collect insertion points (body start + request param name)
  const inserts = [];
  const handlerRe = /export async function (GET|POST|PUT|PATCH|DELETE|HEAD)\s*\(/g;
  let m;
  while ((m = handlerRe.exec(src)) !== null) {
    const openParen = m.index + m[0].length - 1;
    const closeParen = findMatchingParen(src, openParen);
    if (closeParen === -1) continue;
    const params = src.slice(openParen + 1, closeParen).trim();
    let i = closeParen + 1;
    while (i < src.length && src[i] !== "{") i++;
    if (i >= src.length) continue;
    const first = params.split(",")[0] || "";
    const paramName = (first.match(/(_?\w+)\s*:/) || [])[1] || "request";
    inserts.push({ pos: i + 1, paramName });
  }

  if (!inserts.length) {
    console.log("no handlers patched:", file);
    continue;
  }

  // Insert guards back-to-front so offsets stay valid
  for (const ins of inserts.reverse()) {
    src = src.slice(0, ins.pos) + GUARD(ins.paramName) + src.slice(ins.pos);
  }

  src = ensureImport(src, "@/lib/api-auth", "{ requireSuperAdmin }");

  // Ensure NextRequest is imported (needed if we injected a param)
  if (/\(request: NextRequest/.test(src) && !/\bNextRequest\b/.test(src.split(/\bfrom\b/)[0] || "")) {
    if (/import\s*{[^}]*}\s*from\s*"next\/server"/.test(src)) {
      src = src.replace(/import\s*{([^}]*)}\s*from\s*"next\/server"/, (mm, names) => {
        const list = names.split(",").map((s) => s.trim()).filter(Boolean);
        if (!list.includes("NextRequest")) list.unshift("NextRequest");
        return `import { ${list.join(", ")} } from "next/server"`;
      });
    } else {
      src = 'import { NextRequest } from "next/server";\n' + src;
    }
  }

  fs.writeFileSync(file, src);
  console.log("patched:", file, `(${inserts.length} handlers)`);
}
console.log("done");
