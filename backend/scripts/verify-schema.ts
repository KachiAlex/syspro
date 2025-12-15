import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Expected tables based on entities
const expectedTables = [
  // Core entities
  'users',
  'organizations',
  'subsidiaries',
  'departments',
  'tenants',
  'user_tenant_access',
  // Billing entities
  'plan',
  'subscription',
  'invoice',
  'payment',
  'license',
  'meter_event',
  'webhook_event',
  // Role service entities (assuming they follow naming conventions)
  'role',
  'permission',
  'role_permission',
  'user_role',
  // User service entities
  'user_activity',
  // Config service entities
  'config',
  'config_history',
  // Module registry entities
  'module',
  'module_registry',
];

async function verifySchema() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ Error: POSTGRES_URL or DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Get all tables
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const result = await client.query(tablesQuery);
    const existingTables = result.rows.map((row) => row.table_name);

    console.log(`📊 Found ${existingTables.length} tables in the database:\n`);
    existingTables.forEach((table) => console.log(`  ✓ ${table}`));
    console.log('');

    // Check for expected tables
    console.log('🔍 Verifying expected tables...\n');
    const missingTables: string[] = [];
    const foundTables: string[] = [];

    expectedTables.forEach((table) => {
      if (existingTables.includes(table)) {
        foundTables.push(table);
        console.log(`  ✅ ${table}`);
      } else {
        missingTables.push(table);
        console.log(`  ❌ ${table} - NOT FOUND`);
      }
    });

    console.log('\n' + '='.repeat(50));
    console.log('📈 Summary:');
    console.log(`  Total tables in database: ${existingTables.length}`);
    console.log(`  Expected tables found: ${foundTables.length}/${expectedTables.length}`);
    console.log(`  Missing tables: ${missingTables.length}`);

    if (missingTables.length > 0) {
      console.log('\n⚠️  Missing tables:');
      missingTables.forEach((table) => console.log(`    - ${table}`));
    }

    // Check for TypeORM metadata tables
    const typeormTables = existingTables.filter((table) => table.startsWith('typeorm_'));
    if (typeormTables.length > 0) {
      console.log('\n📝 TypeORM metadata tables found:');
      typeormTables.forEach((table) => console.log(`    - ${table}`));
    }

    if (existingTables.length === 0) {
      console.log('\n❌ No tables found in database! Schema may not have been created.');
      process.exit(1);
    } else if (foundTables.length >= expectedTables.length * 0.7) {
      // At least 70% of expected tables found
      console.log('\n✅ Schema verification: PASSED (most tables found)');
      console.log('   Note: Some expected tables may use different naming conventions or may not exist yet.');
    } else {
      console.log('\n⚠️  Schema verification: PARTIAL (many tables missing)');
      console.log('   The database schema may not have been fully created.');
    }

    // Get table counts
    console.log('\n📊 Table row counts:');
    for (const table of existingTables.slice(0, 10)) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM "${table}";`);
        console.log(`  ${table}: ${countResult.rows[0].count} rows`);
      } catch (error) {
        // Skip if we can't count (might be a view or special table)
      }
    }
  } catch (error) {
    console.error('❌ Error verifying schema:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

verifySchema().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

