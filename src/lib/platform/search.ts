import { db } from "@/lib/sql-client";

// Unified global search across the tenant's core entities.

export type SearchHit = {
  entity: string;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

export async function globalSearch(tenantSlug: string, query: string, limit = 8): Promise<SearchHit[]> {
  const q = `%${query.replace(/[%_]/g, (c) => `\\${c}`)}%`;
  const hits: SearchHit[] = [];

  const searches: { entity: string; sql: string; map: (r: any) => SearchHit }[] = [
    {
      entity: "invoices",
      sql: `select id, invoice_number, customer_name, status from finance_invoices
            where tenant_slug = $1 and (invoice_number ilike $2 or customer_name ilike $2)
            order by created_at desc limit $3`,
      map: (r) => ({ entity: "Invoice", id: r.id, title: r.invoice_number, subtitle: `${r.customer_name} · ${r.status}`, href: `/tenant-admin/invoices?highlight=${r.id}` }),
    },
    {
      entity: "customers",
      sql: `select id, name, customer_code, email from finance_customers
            where tenant_slug = $1 and (name ilike $2 or customer_code ilike $2 or email ilike $2)
            order by name limit $3`,
      map: (r) => ({ entity: "Customer", id: r.id, title: r.name, subtitle: r.customer_code ?? r.email, href: `/tenant-admin/crm/customers?highlight=${r.id}` }),
    },
    {
      entity: "items",
      sql: `select id, sku, name, category from inventory_products
            where tenant_slug = $1 and (sku ilike $2 or name ilike $2)
            order by name limit $3`,
      map: (r) => ({ entity: "Item", id: r.id, title: r.sku, subtitle: r.name, href: `/tenant-admin/inventory?highlight=${r.id}` }),
    },
    {
      entity: "orders",
      sql: `select id, order_number, customer_name, status from sales_orders
            where tenant_slug = $1 and (order_number ilike $2 or customer_name ilike $2)
            order by created_at desc limit $3`,
      map: (r) => ({ entity: "Sales Order", id: r.id, title: r.order_number, subtitle: `${r.customer_name} · ${r.status}`, href: `/tenant-admin/sales/orders?highlight=${r.id}` }),
    },
    {
      entity: "employees",
      sql: `select id, name, email, designation from admin_employees
            where tenant_slug = $1 and (name ilike $2 or email ilike $2)
            order by name limit $3`,
      map: (r) => ({ entity: "Employee", id: r.id, title: r.name, subtitle: r.designation ?? r.email, href: `/tenant-admin/hr/staff?highlight=${r.id}` }),
    },
    {
      entity: "tickets",
      sql: `select id, ticket_number, title, status from support_tickets
            where tenant_slug = $1 and (title ilike $2 or ticket_number ilike $2)
            order by created_at desc limit $3`,
      map: (r) => ({ entity: "Ticket", id: r.id, title: r.ticket_number ?? r.title, subtitle: `${r.title} · ${r.status}`, href: `/tenant-admin/it-support?highlight=${r.id}` }),
    },
    {
      entity: "bills",
      sql: `select b.id, b.bill_number, b.status, v.name as vendor_name from bills b
            left join vendors v on v.id = b.vendor_id
            where b.tenant_slug = $1 and (b.bill_number ilike $2 or v.name ilike $2)
            order by b.created_at desc limit $3`,
      map: (r) => ({ entity: "Bill", id: r.id, title: r.bill_number, subtitle: `${r.vendor_name ?? ""} · ${r.status}`, href: `/tenant-admin/bills?highlight=${r.id}` }),
    },
    {
      entity: "quotations",
      sql: `select id, quotation_number, customer_name, status from sales_quotations
            where tenant_slug = $1 and (quotation_number ilike $2 or customer_name ilike $2)
            order by created_at desc limit $3`,
      map: (r) => ({ entity: "Quotation", id: r.id, title: r.quotation_number, subtitle: `${r.customer_name} · ${r.status}`, href: `/tenant-admin/sales/quotations?highlight=${r.id}` }),
    },
  ];

  const per = Math.max(2, Math.ceil(limit / searches.length));
  const results = await Promise.allSettled(
    searches.map(async (s) => {
      const { rows } = await db.query(s.sql, [tenantSlug, q, per]);
      return rows.map(s.map);
    })
  );
  for (const r of results) {
    if (r.status === "fulfilled") hits.push(...r.value);
    // rejected = table absent in this deployment — skip silently
  }
  return hits.slice(0, limit * 2);
}
