-- tenants.seats is NOT NULL in production without a default; inserts that
-- omit the column (provisioning paths, tests) violate the constraint.
alter table if exists tenants alter column seats set default 0;
