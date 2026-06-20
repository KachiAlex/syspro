const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
sql`SELECT filename, applied_at FROM schema_migrations ORDER BY applied_at`
  .then(r => {
    console.log('Applied migrations:');
    r.forEach(row => console.log('  - ' + row.filename + ' at ' + row.applied_at));
  })
  .catch(e => console.error('Error:', e.message));
