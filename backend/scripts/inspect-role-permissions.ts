import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ POSTGRES_URL or DATABASE_URL must be set.');
  process.exit(1);
}

const shouldEnableSsl =
  connectionString.includes('sslmode=require') ||
  connectionString.includes('neon.tech') ||
  connectionString.includes('amazonaws.com');

const client = new Client({
  connectionString,
  ssl: shouldEnableSsl ? { rejectUnauthorized: false } : undefined,
});

async function inspectConstraints() {
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected\n');

    const result = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'role_permissions'::regclass;
    `);

    if (result.rowCount === 0) {
      console.log('⚠️  No constraints found for role_permissions.');
    } else {
      console.log('🔍 Constraints on role_permissions:');
      for (const row of result.rows) {
        console.log(`  • ${row.conname}: ${row.definition}`);
      }
    }
  } catch (error) {
    console.error('❌ Error inspecting constraints:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

inspectConstraints();
