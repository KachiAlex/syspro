create table if not exists admin_salary_structures (
  id text primary key,
  tenant_slug text not null,
  name text not null,
  effective_from date,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  unique (tenant_slug, name)
);
create table if not exists admin_salary_structure_components (
  id text primary key,
  tenant_slug text not null,
  structure_id text not null references admin_salary_structures(id) on delete cascade,
  name text not null,
  component_type text not null check (component_type in ('earning','deduction')),
  amount_type text not null default 'fixed' check (amount_type in ('fixed','percent_of_base')),
  amount numeric(15,2) not null,
  created_at timestamptz default now()
);
create index if not exists idx_ssc_structure on admin_salary_structure_components(tenant_slug, structure_id);
