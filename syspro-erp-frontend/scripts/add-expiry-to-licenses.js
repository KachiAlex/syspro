require('dotenv').config({ path: '.env.local' });
const { getSql } = require('../src/lib/db.js');

const sql = getSql();

async function addExpiryToLicenses() {
  try {
    console.log('Adding expiry column to licenses table...');
    await sql`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS expiry DATE`;
    console.log('Column added.');
  } catch (error) {
    console.error('Migration error:', error.message);
  }
}

addExpiryToLicenses();
