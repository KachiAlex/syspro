-- Unified notification pipeline: domain events → routing rules → outbox →
-- drained by cron into email + persisted in-app notifications.

create table if not exists domain_events (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  event_type text not null,
  source_module text,
  source_record_id text,
  actor_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists domain_events_tenant_idx
  on domain_events(tenant_slug, event_type, created_at desc);

create table if not exists notification_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  event_type text not null,
  channels jsonb not null default '["email"]',
  recipients jsonb not null default '[]',
  enabled boolean not null default true,
  subject_override text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_slug, event_type)
);

create table if not exists notification_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  dedupe_key text not null,
  channel text not null default 'email',
  event_type text not null,
  recipient text not null,
  recipient_name text,
  subject text,
  body_html text,
  body_text text,
  link text,
  status text not null default 'pending',
  attempts int not null default 0,
  next_retry_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(tenant_slug, dedupe_key, channel, recipient)
);
create index if not exists notification_outbox_pending_idx
  on notification_outbox(next_retry_at) where status = 'pending';

create table if not exists app_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  user_id text not null,
  event_type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists app_notifications_user_idx
  on app_notifications(tenant_slug, user_id, read_at, created_at desc);

-- Shared with /api/user/notifications/preferences — prefs live in the jsonb
-- blob ({email, inApp, frequency, quietHours, categories, push}).
create table if not exists user_notification_preferences (
  user_id text primary key,
  tenant_slug text,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
