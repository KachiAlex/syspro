#!/usr/bin/env node
// Schema-drift checker: tables created at runtime via ensure*Tables must have
// a matching db/migrations/*.sql — runtime DDL and migrations are two sources
// of truth and drift silently. Exit 1 when any src-created table has no migration.
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const TABLE_RE = /create\s+table\s+if\s+not\s+exists\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;

// 1. Tables created in source (ensure*Tables functions + route-local ensures)
const srcFiles = execSync(
  'rg -l "create table if not exists" src --type ts 2>nul || grep -rln "create table if not exists" src --include="*.ts"',
  { encoding: 'utf8', shell: true }
).split(/\r?\n/).filter(Boolean);

const srcTables = new Set();
for (const f of srcFiles) {
  const text = readFileSync(join(process.cwd(), f.trim()), 'utf8');
  for (const m of text.matchAll(TABLE_RE)) srcTables.add(m[1].toLowerCase());
}

// 2. Tables covered by migrations
const migTables = new Set();
for (const f of readdirSync('db/migrations')) {
  if (!f.endsWith('.sql')) continue;
  const text = readFileSync(join('db/migrations', f), 'utf8');
  for (const m of text.matchAll(TABLE_RE)) migTables.add(m[1].toLowerCase());
  // catch `create table [schema.]name` (pg_dump emits public.-qualified names)
  for (const m of text.matchAll(/create\s+table\s+(?!if\s+not)(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi))
    migTables.add(m[1].toLowerCase());
}

// Test artifacts / intentionally runtime-only tables exempt from migration.
const IGNORE = new Set(["gate_test_scratch"]);
const missing = [...srcTables].filter((t) => !migTables.has(t) && !IGNORE.has(t)).sort();
console.log(`src tables: ${srcTables.size} | migrations cover: ${migTables.size}`);
if (missing.length) {
  console.log(`\nDRIFT — ${missing.length} table(s) created at runtime with no migration:`);
  for (const t of missing) console.log(`  ${t}`);
  process.exit(1);
}
console.log('No drift — every runtime-created table has a migration.');
