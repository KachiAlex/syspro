require('dotenv').config({ path: '.env.local' });
const { getSql } = require('../src/lib/db.js');

const sql = getSql();

async function fixSuperadminPortalSchema() {
  try {
    console.log('Fixing superadmin portal schema...');
    await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP`;
    await sql`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS type VARCHAR(50)`;
    await sql`ALTER TABLE tenant_admins ADD COLUMN IF NOT EXISTS role VARCHAR(50)`;
    console.log('Schema fixed. All required columns added.');
  } catch (error) {
    console.error('Schema migration error:', error.message);
  }
}

fixSuperadminPortalSchema();
