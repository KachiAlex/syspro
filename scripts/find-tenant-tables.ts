import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(connectionString);

async function main() {
  // Find all tables with a tenant_slug column
  const tables = await sql`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'tenant_slug'
    order by table_name
  `;
  console.log("=== Tables with tenant_slug column ===");
  for (const t of tables) {
    // Count rows per fake tenant for this table
    const counts = await sql(`
      select tenant_slug, count(*)::int as cnt
      from ${t.table_name}
      where tenant_slug in ('gmail-com', 'kreatixtech-com')
      group by tenant_slug
    `);
    const summary = counts.map((c: any) => `${c.tenant_slug}=${c.cnt}`).join(", ") || "no rows in fake tenants";
    console.log(`  ${t.table_name}: ${summary}`);
  }

  // Also check tables with tenant_id (integer FK to tenants table)
  const tenantIdTables = await sql`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'tenant_id'
    order by table_name
  `;
  console.log("\n=== Tables with tenant_id column ===");
  for (const t of tenantIdTables) {
    console.log(`  ${t.table_name}.${t.column_name}`);
  }

  // Check users table for tenant_id references to fake tenants
  const userTenants = await sql`
    select tenant_id, count(*)::int as cnt from users group by tenant_id order by tenant_id
  `;
  console.log("\n=== users table tenant_id distribution ===");
  for (const u of userTenants) {
    console.log(`  tenant_id=${u.tenant_id}: ${u.cnt} users`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
