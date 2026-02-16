require('dotenv').config({ path: '.env.local' });
const { getSql } = require('../src/lib/db.js');

const sql = getSql();

async function addUpdatedAtToLicenses() {
  try {
    console.log('Adding updated_at column to licenses table...');
    await sql`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP`;
    console.log('updated_at column added.');
  } catch (error) {
    console.error('Migration error:', error.message);
  }
}

addUpdatedAtToLicenses();
