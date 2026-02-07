
CREATE EXTENSION IF NOT EXISTS pgcrypto;

/* vendors */
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  branch_id uuid NULL,
  vendor_code text NOT NULL,
  legal_name text NOT NULL,
  display_name text,
  vendor_type text NOT NULL CHECK (vendor_type IN ('service','goods')),
  status text NOT NULL CHECK (status IN ('active','inactive','blacklisted')) DEFAULT 'active',
  primary_contact_id uuid NULL,
  tax_id text NULL,
  default_currency text NOT NULL DEFAULT 'NGN',
  default_payment_terms text NULL,
  default_expense_account text NULL,
  default_tax_rules jsonb NULL,
  bank_details jsonb NULL,
  metadata jsonb NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- ensure tenant_slug exists (safe for pre-existing tables)
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tenant_slug text;
CREATE INDEX IF NOT EXISTS vendors_tenant_idx ON vendors (tenant_slug);
CREATE INDEX IF NOT EXISTS vendors_branch_idx ON vendors (branch_id);
CREATE UNIQUE INDEX IF NOT EXISTS vendors_tenant_code_uq ON vendors (tenant_slug, vendor_code);

/* vendor_contacts */
CREATE TABLE IF NOT EXISTS vendor_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  phone text,
  email text,
  address jsonb,
  is_primary boolean DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendor_contacts_vendor_idx ON vendor_contacts (vendor_id);
CREATE INDEX IF NOT EXISTS vendor_contacts_email_idx ON vendor_contacts (email);

/* purchase_orders */
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  po_number text NOT NULL,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  created_by uuid NULL,
  branch_id uuid NULL,
  department_id uuid NULL,
  project_id uuid NULL,
  status text NOT NULL CHECK (status IN ('draft','pending_approval','approved','fulfilled','closed','cancelled')) DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'NGN',
  subtotal numeric(18,2) NOT NULL DEFAULT 0,
  taxes numeric(18,2) NOT NULL DEFAULT 0,
  total numeric(18,2) NOT NULL DEFAULT 0,
  requested_date date NULL,
  delivery_date date NULL,
  approval_route jsonb NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- ensure tenant_slug exists for compatibility with older schemas
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tenant_slug text;
CREATE INDEX IF NOT EXISTS purchase_orders_tenant_idx ON purchase_orders (tenant_slug);
CREATE UNIQUE INDEX IF NOT EXISTS po_tenant_number_uq ON purchase_orders (tenant_slug, po_number);
CREATE INDEX IF NOT EXISTS purchase_orders_vendor_idx ON purchase_orders (vendor_id);

/* purchase_order_items */
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  sku text NULL,
  description text,
  quantity numeric(12,4) NOT NULL DEFAULT 1,
  unit_price numeric(18,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NULL,
  line_amount numeric(18,2) NOT NULL DEFAULT 0,
  account_code text NULL,
  metadata jsonb NULL
);
CREATE INDEX IF NOT EXISTS po_items_po_idx ON purchase_order_items (po_id);

/* bills */
CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  bill_number text NOT NULL,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  po_id uuid NULL REFERENCES purchase_orders(id) ON DELETE SET NULL,
  created_by uuid NULL,
  branch_id uuid NULL,
  bill_date date NOT NULL,
  due_date date NULL,
  currency text NOT NULL DEFAULT 'NGN',
  subtotal numeric(18,2) NOT NULL DEFAULT 0,
  taxes numeric(18,2) NOT NULL DEFAULT 0,
  total numeric(18,2) NOT NULL DEFAULT 0,
  balance_due numeric(18,2) NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('draft','open','partially_paid','paid','overdue','cancelled')) DEFAULT 'draft',
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- ensure tenant_slug exists
ALTER TABLE bills ADD COLUMN IF NOT EXISTS tenant_slug text;
CREATE INDEX IF NOT EXISTS bills_tenant_idx ON bills (tenant_slug);
CREATE UNIQUE INDEX IF NOT EXISTS bill_tenant_number_uq ON bills (tenant_slug, bill_number);
CREATE INDEX IF NOT EXISTS bills_vendor_idx ON bills (vendor_id);
CREATE INDEX IF NOT EXISTS bills_status_idx ON bills (status);

/* bill_items */
CREATE TABLE IF NOT EXISTS bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  description text,
  quantity numeric(12,4) NOT NULL DEFAULT 1,
  unit_price numeric(18,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NULL,
  line_amount numeric(18,2) NOT NULL DEFAULT 0,
  account_code text NULL,
  metadata jsonb NULL
);
CREATE INDEX IF NOT EXISTS bill_items_bill_idx ON bill_items (bill_id);

/* vendor_payments */
CREATE TABLE IF NOT EXISTS vendor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  payment_number text NOT NULL,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  created_by uuid NULL,
  method text NOT NULL CHECK (method IN ('bank_transfer','cash','corporate_card','other')),
  currency text NOT NULL DEFAULT 'NGN',
  amount numeric(18,2) NOT NULL DEFAULT 0,
  applied_amount numeric(18,2) NOT NULL DEFAULT 0,
  unapplied_amount numeric(18,2) NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('draft','posted','reconciled','cancelled')) DEFAULT 'draft',
  payment_date date NOT NULL,
  bank_details jsonb NULL,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- ensure tenant_slug exists
ALTER TABLE vendor_payments ADD COLUMN IF NOT EXISTS tenant_slug text;
CREATE INDEX IF NOT EXISTS vendor_payments_tenant_idx ON vendor_payments (tenant_slug);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_payment_number_uq ON vendor_payments (tenant_slug, payment_number);
CREATE INDEX IF NOT EXISTS vendor_payments_vendor_idx ON vendor_payments (vendor_id);

/* vendor_payment_applications */
CREATE TABLE IF NOT EXISTS vendor_payment_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES vendor_payments(id) ON DELETE CASCADE,
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  applied_amount numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vp_apps_payment_idx ON vendor_payment_applications (payment_id);
CREATE INDEX IF NOT EXISTS vp_apps_bill_idx ON vendor_payment_applications (bill_id);

/* vendor_balances */
CREATE TABLE IF NOT EXISTS vendor_balances (
  vendor_id uuid PRIMARY KEY REFERENCES vendors(id) ON DELETE CASCADE,
  tenant_slug text NOT NULL,
  outstanding numeric(18,2) NOT NULL DEFAULT 0,
  last_payment_date timestamptz NULL,
  last_updated timestamptz NOT NULL DEFAULT now()
);
-- ensure tenant_slug exists
ALTER TABLE vendor_balances ADD COLUMN IF NOT EXISTS tenant_slug text;
CREATE INDEX IF NOT EXISTS vendor_balances_tenant_idx ON vendor_balances (tenant_slug);

/* approvals */
CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  rule_id uuid NULL,
  status text NOT NULL CHECK (status IN ('pending','approved','rejected','escalated','cancelled')) DEFAULT 'pending',
  requested_by uuid NULL,
  approver_chain jsonb NULL,
  decisions jsonb NULL,
  current_step integer DEFAULT 0,
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- ensure tenant_slug exists
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS tenant_slug text;
-- ensure entity_type/entity_id exist for older schemas
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS entity_id uuid;
CREATE INDEX IF NOT EXISTS approvals_entity_idx ON approvals (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS approvals_tenant_idx ON approvals (tenant_slug);

/* audit_logs */
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  actor_id uuid NULL,
  action text NOT NULL,
  entity_type text NULL,
  entity_id uuid NULL,
  details jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- ensure tenant_slug exists
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_slug text;
-- ensure entity_type/entity_id exist
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id uuid;
CREATE INDEX IF NOT EXISTS audit_tenant_idx ON audit_logs (tenant_slug);
CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_logs (entity_type, entity_id);

/* End migration */
