import { sql as SQL, SqlClient } from "@/lib/sql-client";

export async function ensureReviewTables(sql: SqlClient = SQL) {
  await sql`
    create table if not exists tenant_performance_reviews (
      id text primary key,
      tenant_slug text not null,
      employee_id text not null,
      employee_name text,
      reviewer_id text,
      reviewer_name text,
      rating numeric(3,1) not null,
      comments text,
      review_date date,
      review_period text,
      status text not null default 'in_progress' check (status in ('in_progress','completed')),
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_tenant_reviews on tenant_performance_reviews(tenant_slug)`;
  await sql`alter table tenant_performance_reviews add column if not exists cycle_id text`;
}
