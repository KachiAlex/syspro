import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(connectionString);

async function main() {
  // Sync tenant seats with their active license seats
  const result = await sql`
    UPDATE tenants t
    SET seats = l.seats, updated_at = NOW()
    FROM licenses l
    WHERE l.tenant_id = t.id AND l.status = 'active'
    RETURNING t.id, t.slug, t.name, t.seats as new_seats
  `;
  console.log("Synced tenant seats with license seats:");
  for (const r of result) {
    console.log(`  ${r.name} (${r.slug}): ${r.new_seats} seats`);
  }

  // Verify
  const tenants = await sql`select id, slug, name, seats from tenants order by id`;
  console.log("\nCurrent tenant seats:");
  for (const t of tenants) console.log(`  ${t.name} (${t.slug}): ${t.seats} seats`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
