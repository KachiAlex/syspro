-- API keys were stored in plaintext and returned on every read.
-- Store only hashes; keep a short prefix for display; support soft-revoke.
alter table admin_api_keys
  add column if not exists key_hash text,
  add column if not exists key_prefix text,
  add column if not exists secret_hash text,
  add column if not exists revoked_at timestamptz;

create index if not exists idx_admin_api_keys_key_hash on admin_api_keys(key_hash);
