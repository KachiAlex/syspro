-- SKU uniqueness must be per-tenant: two tenants can legitimately reuse
-- the same SKU. The old global UNIQUE(sku) made tenant B unable to use a
-- SKU that tenant A had already registered.
alter table inventory_products drop constraint if exists inventory_products_sku_key;
alter table inventory_products add constraint inventory_products_tenant_sku_key unique (tenant_slug, sku);
