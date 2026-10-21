-- Normalized sales-order line items.
-- sales_orders.items is a JSON text blob; this table is kept in sync by a
-- trigger so planning/MPS/reporting queries can join and aggregate in SQL
-- with real indexes instead of parsing JSON per-row in application code.

create table if not exists sales_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  order_id text not null references sales_orders (id) on delete cascade,
  line_no integer not null,
  sku text,
  product_name text,
  quantity numeric not null default 0,
  unit_price numeric not null default 0,
  line_total numeric not null default 0,
  unique (order_id, line_no)
);

create index if not exists idx_sales_order_items_tenant_sku
  on sales_order_items (tenant_slug, sku);
create index if not exists idx_sales_order_items_order
  on sales_order_items (order_id);

create or replace function sync_sales_order_items() returns trigger as $$
declare
  it jsonb;
  n integer := 0;
begin
  if tg_op = 'UPDATE' then
    if new.items is not distinct from old.items then
      return new;
    end if;
    delete from sales_order_items where order_id = old.id;
  end if;

  if new.items is null then
    return new;
  end if;

  for it in
    select value from jsonb_array_elements(
      case
        when pg_input_is_valid(new.items, 'jsonb')
             and jsonb_typeof(new.items::jsonb) = 'array'
          then new.items::jsonb
        else '[]'::jsonb
      end
    )
  loop
    n := n + 1;
    insert into sales_order_items
      (tenant_slug, order_id, line_no, sku, product_name, quantity, unit_price, line_total)
    values (
      new.tenant_slug,
      new.id,
      n,
      coalesce(it->>'sku', it->>'productSku', it->>'product_sku'),
      coalesce(it->>'name', it->>'productName', it->>'product_name'),
      case when pg_input_is_valid(it->>'quantity', 'numeric')
            then (it->>'quantity')::numeric
           when pg_input_is_valid(it->>'qty', 'numeric')
            then (it->>'qty')::numeric
           else 0 end,
      case when pg_input_is_valid(it->>'unitPrice', 'numeric')
            then (it->>'unitPrice')::numeric
           when pg_input_is_valid(it->>'unit_price', 'numeric')
            then (it->>'unit_price')::numeric
           when pg_input_is_valid(it->>'price', 'numeric')
            then (it->>'price')::numeric
           else 0 end,
      case when pg_input_is_valid(it->>'total', 'numeric')
            then (it->>'total')::numeric
           when pg_input_is_valid(it->>'lineTotal', 'numeric')
            then (it->>'lineTotal')::numeric
           else 0 end
    );
  end loop;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sales_order_items on sales_orders;
create trigger trg_sales_order_items
  after insert or update of items on sales_orders
  for each row execute function sync_sales_order_items();

-- Backfill existing orders.
insert into sales_order_items
  (tenant_slug, order_id, line_no, sku, product_name, quantity, unit_price, line_total)
select
  so.tenant_slug,
  so.id,
  row_number() over (partition by so.id),
  coalesce(it.value->>'sku', it.value->>'productSku', it.value->>'product_sku'),
  coalesce(it.value->>'name', it.value->>'productName', it.value->>'product_name'),
  case when pg_input_is_valid(it.value->>'quantity', 'numeric')
        then (it.value->>'quantity')::numeric
       when pg_input_is_valid(it.value->>'qty', 'numeric')
        then (it.value->>'qty')::numeric
       else 0 end,
  case when pg_input_is_valid(it.value->>'unitPrice', 'numeric')
        then (it.value->>'unitPrice')::numeric
       when pg_input_is_valid(it.value->>'unit_price', 'numeric')
        then (it.value->>'unit_price')::numeric
       when pg_input_is_valid(it.value->>'price', 'numeric')
        then (it.value->>'price')::numeric
       else 0 end,
  case when pg_input_is_valid(it.value->>'total', 'numeric')
        then (it.value->>'total')::numeric
       when pg_input_is_valid(it.value->>'lineTotal', 'numeric')
        then (it.value->>'lineTotal')::numeric
       else 0 end
from sales_orders so
cross join lateral jsonb_array_elements(
  case
    when pg_input_is_valid(so.items, 'jsonb')
         and jsonb_typeof(so.items::jsonb) = 'array'
      then so.items::jsonb
    else '[]'::jsonb
  end
) it(value)
on conflict (order_id, line_no) do nothing;
