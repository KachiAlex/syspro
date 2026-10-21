-- Retire orphaned table families WITHOUT destroying data.
-- Replaces the original DROP TABLE ... CASCADE plan: hard deletion is
-- irreversible, and CASCADE could remove dependent objects silently.
-- Instead the tables are moved out of `public` into an `archive` schema:
--   * They leave the application query path (search_path = public).
--   * Data, constraints, indexes and FK relationships survive the move
--     (they are OID-based; nothing is rewritten or lost).
--   * Plain `pg_dump -n public` output shrinks as intended.
--   * Fully reversible:  ALTER TABLE archive.x SET SCHEMA public;
-- Actual deletion is deferred to a deliberate follow-up
-- (`DROP SCHEMA archive CASCADE`) after a verified backup and a
-- cooling-off period — a separate, auditable ops decision.
--
-- Canonical replacements (unchanged from the original plan):
--   procurement_* POs  -> purchase_orders + purchase_order_items
--   procurement vendors-> vendors
--   marketing_*        -> revops_* family
--   invoices           -> finance_invoices
--   payments           -> finance_payments
--   sales_opportunities/sales_activities -> CRM deals/activities

create schema if not exists archive;
comment on schema archive is
  'Retired legacy tables pending verified backup + cooling-off before drop';

alter table if exists procurement_purchase_orders set schema archive;
alter table if exists procurement_vendors         set schema archive;
alter table if exists procurement_invoices        set schema archive;
alter table if exists suppliers                   set schema archive;
alter table if exists invoices                    set schema archive;
alter table if exists payments                    set schema archive;

alter table if exists marketing_attribution_records set schema archive;
alter table if exists marketing_campaign_costs      set schema archive;
alter table if exists marketing_assets              set schema archive;
alter table if exists marketing_leads               set schema archive;
alter table if exists marketing_lead_sources        set schema archive;
alter table if exists marketing_campaigns           set schema archive;

alter table if exists sales_opportunities set schema archive;
alter table if exists sales_activities    set schema archive;
