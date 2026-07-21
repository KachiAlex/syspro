import { sql } from '../src/lib/sql-client';

async function main() {
  const rows = await sql`SELECT id, email, name FROM superadmins LIMIT 5`;
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
