# Database Schema Verification Guide

This guide helps you verify that the database schema was created successfully after deployment.

## Method 1: Verify via Neon Dashboard (Easiest)

1. Go to your [Neon Console](https://console.neon.tech)
2. Select your project
3. Navigate to the **SQL Editor**
4. Run the following query:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

This will list all tables in your database. You should see tables like:
- `users`
- `organizations`
- `subsidiaries`
- `departments`
- `tenants`
- `plan`
- `subscription`
- `invoice`
- `payment`
- `license`
- And more...

## Method 2: Verify via API Testing

Test if the API is responding (which indicates database connection is working):

```bash
# Test the root API endpoint
curl https://syspro-ljoe68xlg-onyedikachi-akomas-projects.vercel.app/api

# Expected: Should return a response (may be 401 Unauthorized if auth required)
```

## Method 3: Check Table Count

Run this query in Neon SQL Editor to see how many tables were created:

```sql
SELECT COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';
```

Expected: Should show at least 15-20 tables depending on your entities.

## Method 4: Verify Specific Tables

Check if key tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
AND table_name IN (
  'users',
  'organizations',
  'subsidiaries',
  'plan',
  'subscription',
  'invoice',
  'payment'
)
ORDER BY table_name;
```

All listed tables should appear in the results.

## Method 5: Check for TypeORM Metadata

TypeORM may create metadata tables (these are normal):

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'typeorm_%';
```

## Expected Tables

Based on your entities, you should see:

### Core Entities
- `users`
- `organizations`
- `subsidiaries`
- `departments`
- `tenants`
- `user_tenant_access`

### Billing Service
- `plan`
- `subscription`
- `invoice`
- `payment`
- `license`
- `meter_event`
- `webhook_event`

### Role Service
- `role`
- `permission`
- `role_permission` (junction table)
- `user_role` (junction table)

### User Service
- `user_activity`

### Config Service
- `config`
- `config_history`

### Module Registry
- `module`
- `module_registry`

## Troubleshooting

### No Tables Found

If you see no tables:
1. Check that `ENABLE_SYNC=true` is set in Vercel environment variables
2. Check Vercel deployment logs for database connection errors
3. Verify `POSTGRES_URL` or `DATABASE_URL` is correctly set in Vercel

### Partial Tables

If only some tables exist:
1. Check Vercel function logs for TypeORM errors
2. Verify all entity files are being imported in your modules
3. Check if there were any migration errors

### Connection Errors

If you see connection errors:
1. Verify your Neon connection string is correct
2. Check Neon dashboard for database status
3. Ensure your Neon project is active (not paused)

## Next Steps

After verifying the schema:
1. ✅ **Disable ENABLE_SYNC** in Vercel (set to `false` or remove it)
2. ✅ Redeploy to apply the change
3. ✅ Start using migrations for future schema changes

## Quick Verification Script

If you have the connection string locally, you can run:

```bash
cd backend
npm install pg
node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
client.connect().then(() => {
  return client.query(\"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name\");
}).then(res => {
  console.log('Tables found:', res.rows.map(r => r.table_name).join(', '));
  console.log('Total tables:', res.rows.length);
  return client.end();
});
"
```

