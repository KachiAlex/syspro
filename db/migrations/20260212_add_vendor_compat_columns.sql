-- Compatibility migration: add legacy columns used by older code
BEGIN;

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS code text;

-- populate legacy columns from existing fields if present
UPDATE vendors SET name = COALESCE(display_name, legal_name) WHERE name IS NULL;
UPDATE vendors SET code = COALESCE(vendor_code) WHERE code IS NULL;

-- create indexes expected by code
CREATE INDEX IF NOT EXISTS vendors_name_idx ON vendors (name);
CREATE INDEX IF NOT EXISTS vendors_code_idx ON vendors (code);

COMMIT;
