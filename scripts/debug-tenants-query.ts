import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(connectionString);

async function main() {
  // Check tenants table columns
  const columns = await sql`
    select column_name, data_type from information_schema.columns
    where table_name = 'tenants' order by ordinal_position
  `;
  console.log("tenants columns:");
  for (const c of columns) console.log(`  ${c.column_name}: ${c.data_type}`);

  // Try the exact query the API uses
  try {
    const items = await sql`
      SELECT * FROM tenants
      ORDER BY created_at DESC
      LIMIT 20 OFFSET 0
    `;
    console.log(`\ntenants query succeeded: ${items.length} rows`);
    for (const t of items) console.log(`  ${JSON.stringify(t)}`);
  } catch (err) {
    console.error("\ntenants query failed:", err);
  }

  // Try the count query with empty fragment
  try {
    const countRes = await sql`
      SELECT COUNT(*) AS total FROM tenants
      ${sql``}
    `;
    console.log(`\ncount query with empty fragment: ${countRes[0].total}`);
  } catch (err) {
    console.error("\ncount query with empty fragment failed:", err);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
