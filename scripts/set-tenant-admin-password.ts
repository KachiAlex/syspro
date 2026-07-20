/**
 * Set password for the existing tenant_admin account.
 *
 * Usage:
 *   $env:DATABASE_URL = "..."
 *   npx tsx scripts/set-tenant-admin-password.ts
 */
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(connectionString);

async function main() {
  // Show current tenant_admins
  const admins = await sql`select * from tenant_admins order by created_at asc`;
  console.log("=== Current tenant_admins ===");
  for (const a of admins) {
    console.log(`  id=${a.id} | tenant_id=${a.tenant_id} | email=${a.email} | name=${a.name} | role=${a.role} | has_password=${!!a.password_hash}`);
  }

  // Set password for akoma@kreatixtech.com (tenant_id=170 = kreatixtech)
  const password = "Admin@123";
  const hash = await bcrypt.hash(password, 12);

  await sql`
    update tenant_admins
    set password_hash = ${hash}
    where email = 'akoma@kreatixtech.com'
  `;

  console.log("\nPassword set for akoma@kreatixtech.com");
  console.log(`  Email: akoma@kreatixtech.com`);
  console.log(`  Password: ${password}`);
  console.log(`  Tenant: kreatixtech (id=170)`);

  // Also create a tenant_admin for syscomptech if none exists
  const syscomptechAdmins = await sql`select * from tenant_admins where tenant_id = 171`;
  if (syscomptechAdmins.length === 0) {
    const syscomptechHash = await bcrypt.hash(password, 12);
    await sql`
      insert into tenant_admins (tenant_id, email, name, role, password_hash)
      values (171, 'admin@syscomptech.com', 'Syscomptech Admin', 'admin', ${syscomptechHash})
    `;
    console.log("\nCreated tenant_admin for syscomptech:");
    console.log(`  Email: admin@syscomptech.com`);
    console.log(`  Password: ${password}`);
    console.log(`  Tenant: syscomptech (id=171)`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
