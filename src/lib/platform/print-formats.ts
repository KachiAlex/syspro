import { db } from "@/lib/sql-client";

// Per-doctype print formats: tenant templates rendered as print-ready HTML.
// Templates use {{field}} and {{#each items}}...{{/each}} placeholders.

export async function listPrintFormats(tenantSlug: string, docType?: string) {
  return (await db.query<any>(
    `select id, doc_type, name, is_default, updated_at from print_formats
     where tenant_slug = $1 ${docType ? "and doc_type = $2" : ""}
     order by doc_type, name`,
    docType ? [tenantSlug, docType] : [tenantSlug]
  )).rows;
}

export async function upsertPrintFormat(input: {
  tenantSlug: string;
  id?: string;
  docType: string;
  name: string;
  isDefault?: boolean;
  headerHtml?: string;
  bodyHtml: string;
  footerHtml?: string;
  css?: string;
  createdBy?: string;
}) {
  if (input.isDefault) {
    await db.query(
      `update print_formats set is_default = false
       where tenant_slug = $1 and doc_type = $2`,
      [input.tenantSlug, input.docType]
    );
  }
  if (input.id) {
    return (await db.query<any>(
      `update print_formats set name=$1, is_default=$2, header_html=$3,
         body_html=$4, footer_html=$5, css=$6, updated_at=now()
       where id=$7 and tenant_slug=$8 returning *`,
      [input.name, input.isDefault ?? false, input.headerHtml ?? null,
       input.bodyHtml, input.footerHtml ?? null, input.css ?? null,
       input.id, input.tenantSlug]
    )).rows[0];
  }
  return (await db.query<any>(
    `insert into print_formats (tenant_slug, doc_type, name, is_default,
       header_html, body_html, footer_html, css, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (tenant_slug, doc_type, name) do update set
       is_default = excluded.is_default, header_html = excluded.header_html,
       body_html = excluded.body_html, footer_html = excluded.footer_html,
       css = excluded.css, updated_at = now()
     returning *`,
    [input.tenantSlug, input.docType, input.name, input.isDefault ?? false,
     input.headerHtml ?? null, input.bodyHtml, input.footerHtml ?? null,
     input.css ?? null, input.createdBy ?? null]
  )).rows[0];
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Minimal {{field}} + {{#each arr}} renderer — deliberately not HTML-raw. */
export function renderTemplate(template: string, doc: Record<string, any>): string {
  // {{#each items}} ... {{/each}} loops over array fields.
  let out = template.replace(
    /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_, key: string, inner: string) => {
      const arr = Array.isArray(doc[key]) ? doc[key] : [];
      return arr.map((row) => renderTemplate(inner, row)).join("");
    }
  );
  // {{field}} simple placeholders.
  out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const v = path.split(".").reduce((o: any, k) => o?.[k], doc);
    return esc(v);
  });
  return out;
}

export async function renderPrintFormat(input: {
  tenantSlug: string;
  docType: string;
  doc: Record<string, any>;
  formatId?: string;
}) {
  const fmt = input.formatId
    ? (await db.query<any>(
        `select * from print_formats where id = $1 and tenant_slug = $2`,
        [input.formatId, input.tenantSlug]
      )).rows[0]
    : (await db.query<any>(
        `select * from print_formats where tenant_slug = $1 and doc_type = $2
         order by is_default desc, created_at limit 1`,
        [input.tenantSlug, input.docType]
      )).rows[0];
  if (!fmt) throw new Error(`No print format for ${input.docType}`);

  const header = fmt.header_html ? renderTemplate(fmt.header_html, input.doc) : "";
  const body = renderTemplate(fmt.body_html, input.doc);
  const footer = fmt.footer_html ? renderTemplate(fmt.footer_html, input.doc) : "";
  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(fmt.name)}</title><style>${fmt.css ?? "body{font-family:system-ui;margin:2rem}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 10px;text-align:left}"}</style>
</head><body>${header}${body}${footer}</body></html>`;
  return { html, formatName: fmt.name };
}
