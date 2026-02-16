require('dotenv').config({ path: '.env.local' });
const { getSql } = require('../src/lib/db.js');

const sql = getSql();

async function setupSuperadminPortalTables() {
  try {
    console.log('Setting up superadmin portal tables...');

    await sql`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        seats INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS licenses (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        seats INTEGER NOT NULL,
        expiry DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS tenant_admins (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        password_hash VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS superadmins (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    console.log('All superadmin portal tables created or already exist');
  } catch (error) {
    console.error('Database error:', error.message);
  }
}

setupSuperadminPortalTables();
