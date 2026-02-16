require('dotenv').config({ path: '.env.local' });
const { getSql } = require('../src/lib/db.js');

const sql = getSql();

async function addSeatsToLicenses() {
  try {
    console.log('Adding seats column to licenses table...');
    await sql`ALTER TABLE licenses ADD COLUMN IF NOT EXISTS seats INTEGER`;
    console.log('Column added.');
  } catch (error) {
    console.error('Migration error:', error.message);
  }
}

addSeatsToLicenses();
