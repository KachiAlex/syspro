import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(connectionString);

async function main() {
  // Check if superadmins table exists
  const tableCheck = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name = 'superadmins'
  `;
  console.log("superadmins table exists:", tableCheck.length > 0);

  if (tableCheck.length > 0) {
    // Check columns
    const columns = await sql`
      select column_name, data_type from information_schema.columns
      where table_name = 'superadmins' order by ordinal_position
    `;
    console.log("\nColumns:");
    for (const c of columns) console.log(`  ${c.column_name}: ${c.data_type}`);

    // Check all superadmins
    const admins = await sql`select * from superadmins order by created_at`;
    console.log(`\nSuperadmins (${admins.length}):`);
    for (const a of admins) {
      console.log(`  id=${a.id} | email=${a.email} | name=${a.name} | has_password=${!!a.password_hash} | password_len=${a.password_hash?.length || 0}`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
