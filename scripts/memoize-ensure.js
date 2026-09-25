// Wraps every `export async function ensure*` in a memoized ensureOnce guard.
// The original body is renamed to <name>Run; the exported name becomes a
// sync wrapper returning the shared promise.
const fs = require("fs");
const path = require("path");

const SKIP = new Set(["ensureFinanceSeedForTenant", "ensureDepartmentHeadRole", "ensureAttendanceVerificationTables"]);

function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files = walk(p, files);
    else if (e.name.endsWith(".ts") && !e.name.endsWith(".d.ts")) files.push(p);
  }
  return files;
}

const libDir = path.join(__dirname, "..", "src", "lib");
const files = walk(libDir);
let total = 0;

for (const file of files) {
  let src = fs.readFileSync(file, "utf8");
  if (!src.includes("export async function ensure")) continue;

  const rel = path.relative(libDir, file).replace(/\\/g, "/").replace(/\.ts$/, "");
  let changed = false;

  src = src.replace(/export async function (ensure\w+)\(/g, (m, name) => {
    if (SKIP.has(name)) return m;
    changed = true;
    total++;
    return `export function ${name}(...args: Parameters<typeof ${name}Run>) {\n  return ensureOnce("${rel}:${name}", () => ${name}Run(...args));\n}\n\nasync function ${name}Run(`;
  });

  if (!changed) continue;
  if (!src.includes('from "@/lib/ensure-once"')) {
    // insert import after the last existing import line
    const lines = src.split("\n");
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^import\s/.test(lines[i])) lastImport = i;
      else if (lastImport >= 0 && lines[i].trim() && !lines[i].startsWith(" ")) break;
    }
    lines.splice(lastImport + 1, 0, 'import { ensureOnce } from "@/lib/ensure-once";');
    src = lines.join("\n");
  }
  fs.writeFileSync(file, src);
  console.log("patched", rel);
}
console.log("total functions wrapped:", total);
