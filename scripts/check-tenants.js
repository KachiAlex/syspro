const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tenants' AND table_schema = 'public' ORDER BY ordinal_position`
  .then(r => {
    console.log('tenants columns:');
    r.forEach(row => console.log('  - ' + row.column_name + ' (' + row.data_type + ')'));
  })
  .catch(e => console.error('Error:', e.message));
