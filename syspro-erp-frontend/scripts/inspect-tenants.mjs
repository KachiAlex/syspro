import { neon } from "@neondatabase/serverless";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set");
  }

  const sql = neon(connectionString);
  const columns = await sql`
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants'
    order by ordinal_position
  `;

  console.log(columns);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
