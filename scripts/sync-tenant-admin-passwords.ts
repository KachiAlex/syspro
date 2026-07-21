import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(connectionString);

async function main() {
  // Find tenant_admins with null password_hash
  const admins = await sql`
    SELECT ta.id, ta.email, ta.name, ta.tenant_id, t.slug as tenant_slug, ta.password_hash, t.admin_password_hash
    FROM tenant_admins ta
    JOIN tenants t ON ta.tenant_id = t.id
    WHERE ta.password_hash IS NULL
  `;

  console.log(`Found ${admins.length} tenant_admins with null password_hash`);

  for (const a of admins) {
    if (a.admin_password_hash) {
      console.log(`  Syncing password for ${a.email} (tenant: ${a.tenant_slug})`);
      await sql`UPDATE tenant_admins SET password_hash = ${a.admin_password_hash} WHERE id = ${a.id}`;
      console.log(`  Done.`);
    } else {
      console.log(`  WARNING: ${a.email} (tenant: ${a.tenant_slug}) has no password in either table!`);
    }
  }

  // Also check for tenant_admins that don't exist but should (tenant has admin_email but no tenant_admins row)
  const missingAdmins = await sql`
    SELECT t.id as tenant_id, t.slug, t.admin_email, t.admin_name, t.admin_password_hash
    FROM tenants t
    WHERE t.admin_email IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM tenant_admins ta WHERE ta.tenant_id = t.id AND ta.email = t.admin_email
    )
  `;

  console.log(`\nFound ${missingAdmins.length} tenants with admin_email but no matching tenant_admins row`);

  for (const t of missingAdmins) {
    console.log(`  Creating tenant_admin for ${t.admin_email} (tenant: ${t.slug})`);
    await sql`
      INSERT INTO tenant_admins (tenant_id, email, name, role, password_hash)
      VALUES (${t.tenant_id}, ${t.admin_email}, ${t.admin_name || 'Admin'}, 'admin', ${t.admin_password_hash})
    `;
    console.log(`  Done.`);
  }

  // Final check: show all tenant_admins and their password status
  const allAdmins = await sql`
    SELECT ta.id, ta.email, ta.name, t.slug as tenant_slug, ta.password_hash IS NOT NULL as has_password
    FROM tenant_admins ta
    JOIN tenants t ON ta.tenant_id = t.id
    ORDER BY ta.created_at
  `;

  console.log("\n=== All tenant_admins ===");
  for (const a of allAdmins) {
    console.log(`  id=${a.id} | tenant=${a.tenant_slug} | email=${a.email} | has_password=${a.has_password}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
