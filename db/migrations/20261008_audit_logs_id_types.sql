-- audit_logs was provisioned with uuid columns, but tenants.id is integer.
-- Platform audit inserts (suspend/activate/delete) silently failed on the
-- type cast — the table held zero rows. Align column types with the real
-- entity id types. Table is empty in production; USING casts are lossless.
alter table audit_logs
  alter column tenant_id type text using tenant_id::text,
  alter column actor_id type text using actor_id::text,
  alter column target_id type text using target_id::text;
