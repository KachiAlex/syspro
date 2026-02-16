require('dotenv').config({ path: '.env.local' });
const { getSql } = require('../src/lib/db.js');

const sql = getSql();

async function addFinalColumns() {
  try {
    console.log('Adding status to licenses and updated_at to tenant_admins...');
    await sql`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS status VARCHAR(50)`;
    await sql`ALTER TABLE tenant_admins ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP`;
    console.log('Columns added.');
  } catch (error) {
    console.error('Migration error:', error.message);
  }
}

addFinalColumns();
