-- POS multi-branch + offline local invoice number (mirrors runtime ensure*Tables
-- in src/lib/pos/sales.ts and src/lib/pos/registers.ts).
alter table if exists pos_sales add column if not exists branch_id text;
alter table if exists pos_sales add column if not exists local_invoice_no text;
create unique index if not exists pos_sales_local_inv on pos_sales (tenant_slug, local_invoice_no) where local_invoice_no is not null;
create index if not exists pos_sales_branch on pos_sales (tenant_slug, branch_id) where branch_id is not null;
alter table if exists pos_registers add column if not exists branch_id text;
