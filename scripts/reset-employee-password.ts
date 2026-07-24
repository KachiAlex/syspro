import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const password = "dikaoliver2660";
  const hash = await bcrypt.hash(password, 12);

  await sql`
    UPDATE admin_employees 
    SET password_hash = ${hash}, is_portal_active = true, updated_at = now()
    WHERE email = 'onyedika.akoma@gmail.com'
  `;

  console.log("Employee password set to: dikaoliver2660");
  console.log("Hash:", hash.substring(0, 30) + "...");

  // Verify it works
  const rows = await sql`SELECT password_hash, is_portal_active FROM admin_employees WHERE email = 'onyedika.akoma@gmail.com'`;
  const match = await bcrypt.compare(password, rows[0].password_hash);
  console.log("Verification (bcrypt.compare):", match);
  console.log("is_portal_active:", rows[0].is_portal_active);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
