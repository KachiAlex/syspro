require('dotenv').config({ path: '.env.local' });
const { getSql } = require('../src/lib/db.js');

const sql = getSql();

async function fixLicenseKeyNullable() {
  try {
    console.log('Making license_key column nullable in licenses table...');
    await sql`ALTER TABLE licenses ALTER COLUMN license_key DROP NOT NULL`;
    console.log('license_key column is now nullable.');
  } catch (error) {
    console.error('Migration error:', error.message);
  }
}

fixLicenseKeyNullable();
