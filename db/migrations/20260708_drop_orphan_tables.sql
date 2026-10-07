-- Drop orphaned table families that have no code paths and zero rows.
-- Canonical replacements:
--   vendors            -> vendors
--   procurement_* POs  -> purchase_orders + purchase_order_items
--   marketing_*        -> revops_* family
--   invoices           -> finance_invoices
--   sales_opportunities/sales_activities -> CRM deals/activities (unused legacy)

begin;

drop table if exists procurement_purchase_orders cascade;
drop table if exists procurement_vendors cascade;
drop table if exists procurement_invoices cascade;
drop table if exists suppliers cascade;
drop table if exists invoices cascade;

drop table if exists marketing_attribution_records cascade;
drop table if exists marketing_campaign_costs cascade;
drop table if exists marketing_assets cascade;
drop table if exists marketing_leads cascade;
drop table if exists marketing_lead_sources cascade;
drop table if exists marketing_campaigns cascade;

drop table if exists sales_opportunities cascade;
drop table if exists sales_activities cascade;

commit;

-- `payments` (legacy, FK'd to dropped `invoices`) — unused, canonical is finance_payments
drop table if exists payments cascade;
