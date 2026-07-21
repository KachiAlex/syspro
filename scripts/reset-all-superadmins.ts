import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(connectionString);

async function main() {
  const password = "Admin@123";
  const hash = await bcrypt.hash(password, 12);

  await sql`update superadmins set password_hash = ${hash}`;

  const rows = await sql`SELECT id, email, name FROM superadmins`;
  console.log("All superadmin passwords reset to: Admin@123");
  console.log("Superadmin accounts:");
  for (const r of rows) {
    console.log(`  ${r.email} / Admin@123`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
