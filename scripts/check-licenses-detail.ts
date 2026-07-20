import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(connectionString);

async function main() {
  const columns = await sql`
    select column_name, data_type from information_schema.columns
    where table_name = 'licenses' order by ordinal_position
  `;
  console.log("licenses columns:");
  for (const c of columns) console.log(`  ${c.column_name}: ${c.data_type}`);

  const rows = await sql`select * from licenses order by created_at`;
  console.log(`\nRows: ${rows.length}`);
  for (const r of rows) console.log(`  ${JSON.stringify(r)}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
