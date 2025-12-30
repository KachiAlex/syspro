import { Client } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    '❌ POSTGRES_URL or DATABASE_URL must be set before running this script.',
  );
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

async function resetRolePermissionsConstraint() {
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected\n');

    console.log('🧨 Dropping public schema (if present)...');
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');

    console.log('📦 Recreating public schema...');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO public');

    console.log('🔁 Ensuring uuid-ossp extension exists...');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    console.log('\n✅ Schema prepared successfully for TypeORM sync.');
  } catch (error) {
    console.error('❌ Error while preparing schema:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

resetRolePermissionsConstraint();
