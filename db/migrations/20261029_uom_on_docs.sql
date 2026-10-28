alter table if exists purchase_receipt_items add column if not exists uom text;
alter table if exists delivery_note_items add column if not exists uom text;
