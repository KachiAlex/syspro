// One-off verification: compare Neon vs VPS Postgres table-by-table.
// Reads connection strings from .env.local without printing secrets.
const fs = require("fs");
const { Client } = require("pg");
const { Pool } = require("@neondatabase/serverless");

const envText = fs.readFileSync(".env.local", "utf8");
const neonLine = envText.split("\n").find((l) => l.includes("neon.tech"));
const vpsLine = envText.split("\n").find((l) => /^DATABASE_URL=.*localhost:5433/.test(l));
const neonUrl = neonLine.replace(/^#\s*DATABASE_URL="?|"\s*$/g, "").trim();
const vpsUrl = vpsLine.replace(/^DATABASE_URL=/, "").trim().replace(/^"|"$/g, "");

async function neonTables() {
  const pool = new Pool({ connectionString: neonUrl });
  const { rows: tables } = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`
  );
  const out = {};
  for (const t of tables) {
    const r = await pool.query(`SELECT count(*)::int AS c FROM "${t.table_name}"`);
    out[t.table_name] = r.rows[0].c;
  }
  await pool.end();
  return out;
}

async function vpsTables() {
  const client = new Client({ connectionString: vpsUrl });
  await client.connect();
  const { rows: tables } = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`
  );
  const out = {};
  for (const t of tables) {
    const r = await client.query(`SELECT count(*)::int AS c FROM "${t.table_name}"`);
    out[t.table_name] = r.rows[0].c;
  }
  await client.end();
  return out;
}

(async () => {
  const neonTablesCount = await neonTables();
  const vpsTablesCount = await vpsTables();

  const allNames = new Set([...Object.keys(neonTablesCount), ...Object.keys(vpsTablesCount)]);
  const onlyNeon = [], onlyVps = [], mismatch = [], match = [];
  for (const name of [...allNames].sort()) {
    const n = neonTablesCount[name], v = vpsTablesCount[name];
    if (n === undefined) onlyVps.push(`${name} (${v})`);
    else if (v === undefined) onlyNeon.push(`${name} (${n})`);
    else if (n !== v) mismatch.push(`${name}: neon=${n} vps=${v}`);
    else match.push(name);
  }

  console.log(`\n=== RESULT ===`);
  console.log(`neon tables: ${Object.keys(neonTablesCount).length}, vps tables: ${Object.keys(vpsTablesCount).length}`);
  console.log(`identical row counts: ${match.length}`);
  console.log(`\nONLY IN NEON (missing on VPS):`);
  onlyNeon.forEach((t) => console.log(`  ${t}`));
  console.log(`\nONLY IN VPS (newer/post-migration):`);
  onlyVps.forEach((t) => console.log(`  ${t}`));
  console.log(`\nROW COUNT MISMATCHES:`);
  mismatch.forEach((t) => console.log(`  ${t}`));
})().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
