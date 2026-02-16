require('dotenv').config({ path: '.env.local' });
const { getSql } = require('../src/lib/db.js');

const sql = getSql();

async function fixNullableColumns() {
  try {
    console.log('Making license_key and password_hash columns nullable...');
    await sql`ALTER TABLE licenses ALTER COLUMN license_key DROP NOT NULL`;
    await sql`ALTER TABLE tenant_admins ALTER COLUMN password_hash DROP NOT NULL`;
    console.log('Columns are now nullable.');
  } catch (error) {
    console.error('Migration error:', error.message);
  }
}

fixNullableColumns();
