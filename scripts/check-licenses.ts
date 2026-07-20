import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(connectionString);

async function main() {
  // Check if tenant_licenses table exists
  const tableCheck = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name = 'tenant_licenses'
  `;
  console.log("tenant_licenses table exists:", tableCheck.length > 0);

  if (tableCheck.length > 0) {
    const columns = await sql`
      select column_name, data_type from information_schema.columns
      where table_name = 'tenant_licenses' order by ordinal_position
    `;
    console.log("\nColumns:");
    for (const c of columns) console.log(`  ${c.column_name}: ${c.data_type}`);

    const rows = await sql`select * from tenant_licenses order by created_at`;
    console.log(`\nRows: ${rows.length}`);
    for (const r of rows) console.log(`  ${JSON.stringify(r)}`);
  } else {
    // Check what license-related tables exist
    const tables = await sql`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_name like '%license%'
      order by table_name
    `;
    console.log("\nLicense-related tables:");
    for (const t of tables) console.log(`  ${t.table_name}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
