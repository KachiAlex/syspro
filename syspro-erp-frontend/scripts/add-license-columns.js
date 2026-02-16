require('dotenv').config({ path: '.env.local' });
const { getSql } = require('../src/lib/db.js');

const sql = getSql();

async function addLicenseColumns() {
  try {
    console.log('Adding seats and expiry columns to licenses table...');
    await sql`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS seats INTEGER`;
    await sql`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS expiry DATE`;
    console.log('Columns added.');
  } catch (error) {
    console.error('Migration error:', error.message);
  }
}

addLicenseColumns();
