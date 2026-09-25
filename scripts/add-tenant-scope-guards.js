#!/usr/bin/env node
/**
 * One-shot: insert `requireTenantScope` guards into write handlers of API
 * routes that accept a client-supplied tenantSlug. The helper resolves the
 * tenant from query/header/body itself, so insertion is uniform.
 */
const fs = require("fs");

const FILES = [
  "src/app/api/attendance/policies/route.ts",
  "src/app/api/attendance/timesheet/route.ts",
  "src/app/api/finance/expenses/route.ts",
  "src/app/api/finance/expenses/[id]/approve/route.ts",
  "src/app/api/finance/fiscal-periods/route.ts",
  "src/app/api/finance/journal-entries/route.ts",
  "src/app/api/finance/reports/generate/route.ts",
  "src/app/api/finance/vendor-payments/route.ts",
  "src/app/api/finance/invoices/[id]/receive-payment/route.ts",
  "src/app/api/hr/applications/route.ts",
  "src/app/api/hr/applications/[id]/route.ts",
  "src/app/api/hr/applications/[id]/screen/route.ts",
  "src/app/api/hr/attendance/route.ts",
  "src/app/api/hr/candidates/route.ts",
  "src/app/api/hr/candidates/[id]/route.ts",
  "src/app/api/hr/departments/route.ts",
  "src/app/api/hr/employees/migrate-departments/route.ts",
  "src/app/api/hr/employees/module-presets/route.ts",
  "src/app/api/hr/interviews/[id]/route.ts",
  "src/app/api/hr/leave/route.ts",
  "src/app/api/hr/leave/[id]/route.ts",
  "src/app/api/hr/offers/[id]/route.ts",
  "src/app/api/hr/onboarding-tasks/[id]/route.ts",
  "src/app/api/hr/payroll/route.ts",
  "src/app/api/hr/requisitions/[id]/route.ts",
  "src/app/api/hr/requisitions/[id]/run-ai-screening/route.ts",
  "src/app/api/hr/requisitions/[id]/screening-config/route.ts",
  "src/app/api/hr/resumes/upload/route.ts",
  "src/app/api/hr/staff-report-templates/route.ts",
  "src/app/api/hr/staff-reports/route.ts",
  "src/app/api/hr/staff-tasks/route.ts",
  "src/app/api/inventory/stock-movements/route.ts",
  "src/app/api/manufacturing/mrp/route.ts",
  "src/app/api/procurement/requisitions/route.ts",
  "src/app/api/tenant/access-restrictions/route.ts",
  "src/app/api/tenant/settings/route.ts",
  "src/app/api/tenant/users/assign-role/route.ts",
];

const GUARD = (param) =>
  `\n    const _scope = await requireTenantScope(${param});\n    if (!_scope.ok) return _scope.response;\n`;

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
  if (!fs.existsSync(file)) {
    console.log("missing:", file);
    continue;
  }
  let src = fs.readFileSync(file, "utf8");
  if (src.includes("requireTenantScope")) {
    console.log("skip (already guarded):", file);
    continue;
  }

  const inserts = [];
  const handlerRe = /export async function (POST|PUT|PATCH|DELETE)\s*\(/g;
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
    console.log("no write handlers:", file);
    continue;
  }

  for (const ins of inserts.reverse()) {
    src = src.slice(0, ins.pos) + GUARD(ins.paramName) + src.slice(ins.pos);
  }
  src = ensureImport(src, "@/lib/api-auth", "{ requireTenantScope }");
  fs.writeFileSync(file, src);
  console.log("patched:", file, `(${inserts.length} handlers)`);
}
console.log("done");
