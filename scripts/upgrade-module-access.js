/**
 * Codemod: upgrade requireTenantScope() calls to requireModuleAccess() with a
 * module name + read/write level derived from the HTTP method. For handlers
 * with no scope check at all (and a usable `request`/`req` param), inserts one.
 *
 * Module mapping is by longest path-prefix match.
 */
const fs = require("fs");

const MODULE_MAP = [
  ["api/hr/employees/bulk-modules", "admin"],
  ["api/hr/employees/module-presets", "admin"],
  ["api/hr/employees/permission-audit", "admin"],
  ["api/hr/employees/migrate-departments", "admin"],
  ["api/accounting", "finance"],
  ["api/finance", "finance"],
  ["api/procurement", "finance"],
  ["api/purchases", "finance"],
  ["api/attendance", "people"],
  ["api/hr", "people"],
  ["api/inventory", "admin"],
  ["api/manufacturing", "admin"],
  ["api/policies", "admin"],
  ["api/tenant", "admin"],
  ["api/admin", "admin"],
  ["api/reports", "analytics"],
  ["api/sales", "sales"],
  ["api/revops", "sales"],
];

function moduleFor(rel) {
  const norm = rel.replace(/\\/g, "/").replace(/^src\/app\//, "").replace(/\/route\.ts$/, "");
  let best = null;
  for (const [prefix, mod] of MODULE_MAP) {
    if (norm === prefix || norm.startsWith(prefix + "/")) {
      if (!best || prefix.length > best[0].length) best = [prefix, mod];
    }
  }
  return best ? best[1] : null;
}

function findMatching(src, openIdx, open, close) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function transform(src, module) {
  const re = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(\s*(\w+)/g;
  const handlers = [];
  let m;
  while ((m = re.exec(src))) {
    const method = m[1];
    const paramName = m[2];
    const openParenIdx = src.indexOf("(", m.index + m[0].indexOf("("));
    const cp = findMatching(src, openParenIdx, "(", ")");
    if (cp === -1) continue;
    let j = cp + 1;
    while (j < src.length && /\s/.test(src[j])) j++;
    if (src[j] === ":") while (j < src.length && src[j] !== "{") j++;
    if (src[j] !== "{") continue;
    const cb = findMatching(src, j, "{", "}");
    if (cb === -1) continue;
    handlers.push({ method, paramName, bodyStart: j + 1, bodyEnd: cb });
  }
  if (!handlers.length) return { src, count: 0 };

  let out = src;
  let count = 0;
  // Process back-to-front so offsets stay valid
  for (const h of handlers.sort((a, b) => b.bodyStart - a.bodyStart)) {
    const level = h.method === "GET" ? "read" : "write";
    const body = out.slice(h.bodyStart, h.bodyEnd);

    const scopeIdx = body.indexOf("requireTenantScope(");
    if (scopeIdx !== -1) {
      // Replace requireTenantScope(<args>) with requireModuleAccess(<args>, mod, level)
      const abs = h.bodyStart + scopeIdx;
      const callOpen = out.indexOf("(", abs);
      const callClose = findMatching(out, callOpen, "(", ")");
      if (callClose === -1 || callClose > h.bodyEnd) continue;
      const args = out.slice(callOpen + 1, callClose);
      out = out.slice(0, abs) +
        `requireModuleAccess(${args}, "${module}", "${level}")` +
        out.slice(callClose + 1);
      count++;
      continue;
    }

    // No scope check in this handler — insert one if the param is usable
    if (h.paramName.startsWith("_") || (h.paramName !== "request" && h.paramName !== "req")) continue;
    const ins = `\n    const _scope = await requireModuleAccess(${h.paramName}, "${module}", "${level}");\n    if (!_scope.ok) return _scope.response;\n`;
    out = out.slice(0, h.bodyStart) + ins + out.slice(h.bodyStart);
    count++;
  }

  if (!count) return { src, count: 0 };

  // Fix imports: ensure requireModuleAccess is imported; drop requireTenantScope if unused
  if (!out.includes('from "@/lib/api-auth"') && !out.includes("from '@/lib/api-auth'")) {
    const importRe = /^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm;
    let last = null;
    while ((m = importRe.exec(out))) last = m;
    if (last) {
      const insertAt = last.index + last[0].length;
      out = out.slice(0, insertAt) + `\nimport { requireModuleAccess } from "@/lib/api-auth";` + out.slice(insertAt);
    }
  } else {
    const importMatch = out.match(/import\s*\{([^}]*)\}\s*from\s*["']@\/lib\/api-auth["'];/);
    if (importMatch) {
      let names = importMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
      if (!names.includes("requireModuleAccess")) names.push("requireModuleAccess");
      if (!/requireTenantScope\s*\(/.test(out)) {
        names = names.filter((n) => n !== "requireTenantScope");
      }
      out = out.replace(importMatch[0], `import { ${names.join(", ")} } from "@/lib/api-auth";`);
    }
  }
  return { src: out, count };
}

const files = process.argv.slice(2);
for (const rel of files) {
  const mod = moduleFor(rel);
  if (!mod) { console.log("NOMAP", rel); continue; }
  const src = fs.readFileSync(rel, "utf8");
  const { src: out, count } = transform(src, mod);
  if (count === 0) { console.log("NOOP", rel); continue; }
  fs.writeFileSync(rel, out);
  console.log(`PATCHED ${rel} [${mod}] (+${count} handlers)`);
}
