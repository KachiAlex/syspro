const { neon } = require('@neondatabase/serverless');

function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }
  return neon(connectionString);
}

module.exports = { getSql };