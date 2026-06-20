const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function repair() {
  console.log('Repairing schema...');

  // 1. Fix tenants table: add settings column
  await sql`ALTER TABLE IF EXISTS tenants ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb`;
  console.log('  + tenants.settings column ensured');

  // 2. Create users table if missing (no FK to tenants because tenants.id is integer, not uuid)
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id integer NOT NULL,
      email text NOT NULL,
      name text,
      status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','suspended','terminated')),
      contract_type text DEFAULT 'full_time' CHECK (contract_type IN ('full_time','part_time','contractor','intern')),
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS primary_role_id uuid`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users (tenant_id, lower(email))`;
  console.log('  + users table ensured');

  // 3. Create roles table if missing
  await sql`
    CREATE TABLE IF NOT EXISTS roles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id integer NOT NULL,
      name text NOT NULL,
      description text,
      is_predefined boolean NOT NULL DEFAULT false,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  console.log('  + roles table ensured');

  // 4. Create permissions table if missing
  await sql`
    CREATE TABLE IF NOT EXISTS permissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      key text NOT NULL UNIQUE,
      module text,
      action text,
      description text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  console.log('  + permissions table ensured');

  // 5. Create role_permissions table if missing
  await sql`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    )
  `;
  console.log('  + role_permissions table ensured');

  // 6. Create user_roles table if missing
  await sql`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      is_primary boolean NOT NULL DEFAULT false,
      assigned_by uuid,
      assigned_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NULL,
      PRIMARY KEY (user_id, role_id)
    )
  `;
  console.log('  + user_roles table ensured');

  // 7. Create invitations table if missing
  await sql`
    CREATE TABLE IF NOT EXISTS invitations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id integer NOT NULL,
      email text NOT NULL,
      invited_by uuid,
      invited_at timestamptz NOT NULL DEFAULT now(),
      token text NOT NULL,
      expires_at timestamptz,
      accepted boolean NOT NULL DEFAULT false
    )
  `;
  console.log('  + invitations table ensured');

  // 8. Ensure admin_employees has all needed columns
  await sql`ALTER TABLE IF EXISTS admin_employees ADD COLUMN IF NOT EXISTS phone text`;
  await sql`ALTER TABLE IF EXISTS admin_employees ADD COLUMN IF NOT EXISTS job_title text`;
  await sql`ALTER TABLE IF EXISTS admin_employees ADD COLUMN IF NOT EXISTS reporting_manager_id text`;
  await sql`ALTER TABLE IF EXISTS admin_employees ADD COLUMN IF NOT EXISTS cost_center text`;
  await sql`ALTER TABLE IF EXISTS admin_employees ADD COLUMN IF NOT EXISTS hire_date timestamptz`;
  await sql`ALTER TABLE IF EXISTS admin_employees ADD COLUMN IF NOT EXISTS salary numeric(15,2)`;
  await sql`ALTER TABLE IF EXISTS admin_employees ADD COLUMN IF NOT EXISTS employment_type text DEFAULT 'full-time' CHECK (employment_type IN ('full-time','part-time','contract','intern'))`;
  await sql`ALTER TABLE IF EXISTS admin_employees ADD COLUMN IF NOT EXISTS role text DEFAULT 'staff' CHECK (role IN ('staff','hod','admin','executive'))`;
  await sql`ALTER TABLE IF EXISTS admin_employees ADD COLUMN IF NOT EXISTS created_by text`;
  await sql`ALTER TABLE IF EXISTS admin_employees ADD COLUMN IF NOT EXISTS updated_by text`;
  console.log('  + admin_employees columns ensured');

  console.log('Schema repair complete.');
}

repair().catch(e => {
  console.error('Schema repair failed:', e.message);
  process.exit(1);
});
