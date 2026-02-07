import { neon } from "@neondatabase/serverless";

const connectionString = "postgresql://neondb_owner:npg_0eOB6ifTWDaC@ep-twilight-dust-a40auvl2-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

try {
  const sql = neon(connectionString);
  const result = await sql`SELECT 1 as test`;
  console.log("✓ Database connection successful:", result);
} catch (error) {
  console.error("✗ Database connection failed:", error.message);
}
