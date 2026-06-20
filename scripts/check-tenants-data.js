const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
sql`SELECT id, slug, name FROM tenants LIMIT 5`
  .then(r => {
    console.log('Tenants data:');
    r.forEach(row => console.log('  ', row.id, row.slug, row.name));
    return sql`SELECT COUNT(*) as count FROM tenants`;
  })
  .then(r => console.log('Total tenants:', r[0].count))
  .catch(e => console.error('Error:', e.message));
