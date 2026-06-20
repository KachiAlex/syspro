const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
  .then(r => {
    if (r.length === 0) {
      console.log('No tables found in public schema');
    } else {
      console.log('Tables in public schema:');
      r.forEach(row => console.log('  - ' + row.tablename));
    }
  })
  .catch(e => console.error('Error:', e.message));
