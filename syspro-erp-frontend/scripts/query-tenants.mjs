import { neon } from "@neondatabase/serverless";

async function main(){
  const connectionString = process.env.DATABASE_URL;
  if(!connectionString) throw new Error('DATABASE_URL must be set');
  const sql = neon(connectionString);
  const rows = await sql`select id,name,slug,region,status,admin_email,"createdAt" from tenants order by "createdAt" desc limit 20`;
  console.log(JSON.stringify(rows, null, 2));
}

main().catch(err=>{ console.error(err); process.exit(1); });
