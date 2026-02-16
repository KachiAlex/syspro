require('dotenv').config({ path: '.env.local' });
const { getSql } = require('../src/lib/db.js');

const sql = getSql();

async function setupSuperadminTable() {
  try {
    console.log('Setting up superadmins table...');

    // Create superadmins table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS superadmins (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    console.log('Superadmins table created or already exists');

    // Check if table exists
    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'superadmins'`;
    console.log('Superadmins table exists:', tables.length > 0);

  } catch (error) {
    console.error('Database error:', error.message);
  }
}

setupSuperadminTable();