-- Invoices store ISO currency codes. Legacy rows written from the create form
-- hold the display symbol (₦); normalise them to NGN. Writes now canonicalise
-- at the database boundary (toCurrencyCode in src/lib/currencies.ts).
update finance_invoices set currency = 'NGN' where currency = '₦';
