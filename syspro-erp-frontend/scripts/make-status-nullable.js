require('dotenv').config({ path: '.env.local' });
const { getSql } = require('../src/lib/db.js');

const sql = getSql();

async function makeStatusNullable() {
  try {
    console.log('Making status column nullable in licenses table...');
    await sql`ALTER TABLE licenses ALTER COLUMN status DROP NOT NULL`;
    console.log('status column is now nullable.');
  } catch (error) {
    console.error('Migration error:', error.message);
  }
}

makeStatusNullable();
