-- Customer contact email for finance customers and invoices — enables
-- party-targeted notifications (invoice issued, payment receipt, dunning).
alter table if exists finance_customers add column if not exists email text;
alter table if exists finance_invoices add column if not exists customer_email text;

-- Backfill finance_customers.email from the CRM primary-contact email where
-- the company names match (primary_contact is jsonb: {name, email, phone}).
update finance_customers fc
set email = cc.primary_contact->>'email'
from crm_customers cc
where fc.tenant_slug = cc.tenant_slug
  and fc.email is null
  and cc.primary_contact->>'email' is not null
  and cc.primary_contact->>'email' <> ''
  and lower(trim(fc.name)) = lower(trim(cc.name));

-- Backfill invoices created before the column existed.
update finance_invoices fi
set customer_email = fc.email
from finance_customers fc
where fi.tenant_slug = fc.tenant_slug
  and fi.customer_email is null
  and fc.email is not null
  and (fi.customer_id = fc.id or fi.customer_code = fc.customer_code);
