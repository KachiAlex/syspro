import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const sql = neon(process.env.DATABASE_URL);

async function main() {
  const rows = await sql`SELECT password_hash FROM admin_employees WHERE email = 'onyedika.akoma@gmail.com'`;
  const hash = rows[0].password_hash;
  
  const passwords = [
    'employee123', 'test123', 'password', 'admin123', '123456', 'password123',
    'Welcome123', 'Admin@123', 'kachi123', 'onyedika123', 'kreatixtech',
    'admin', 'test', 'password1', 'changeme', 'letmein', 'qwerty', 'abc123',
    'test1234', 'Password123', 'Password@123', 'employee', 'Employee123',
    'Employee@123', 'kreatix123', 'Kreatix@123', 'syspro123', 'Syspro@123',
  ];
  
  let found = false;
  for (const p of passwords) {
    const m = await bcrypt.compare(p, hash);
    if (m) {
      console.log('MATCH:', p);
      found = true;
      break;
    }
  }
  
  if (!found) {
    console.log('No match found among common passwords');
    console.log('Hash prefix:', hash.substring(0, 30));
  }
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
