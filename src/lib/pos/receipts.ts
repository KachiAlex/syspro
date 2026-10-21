import { sql as SQL } from "@/lib/sql-client";
import { getPosSale } from "./sales";

// ---------------------------------------------------------------------------
// Receipt rendering: ESC/POS byte payload for thermal printers and an
// e-receipt (email/SMS-text) delivery path on top of the mailer.
// ---------------------------------------------------------------------------

const ESC = "\x1B", GS = "\x1D";
const enc = (s: string) => s;

/** Builds an ESC/POS payload. Feed to a printer bridge as binary/latin-1. */
export function buildEscPosReceipt(sale: {
  receiptNo: string;
  createdAt?: string;
  items: Array<{ name: string; qty: number; price: number; amount: number; discount?: number }>;
  tenders: Array<{ method: string; amount: number; tendered?: number; currency?: string; amountForeign?: number }>;
  total: number; tax: number; discount: number; change: number;
  customerName?: string | null; tenantName?: string;
}) {
  const W = 42; // chars per line on 80mm
  const lr = (l: string, r: string) => {
    const space = W - l.length - r.length;
    return l + " ".repeat(Math.max(1, space)) + r;
  };
  const money = (n: number) => Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2 });
  const div = "-".repeat(W) + "\n";

  let out = "";
  out += ESC + "@"; // init
  out += ESC + "a" + "\x01"; // center
  out += ESC + "E" + "\x01" + enc((sale.tenantName ?? "RECEIPT").slice(0, W)) + "\n" + ESC + "E" + "\x00";
  out += enc(`Receipt ${sale.receiptNo}`) + "\n";
  out += enc((sale.createdAt ?? new Date().toISOString()).slice(0, 19).replace("T", " ")) + "\n";
  if (sale.customerName) out += enc(`Customer: ${sale.customerName}`.slice(0, W)) + "\n";
  out += ESC + "a" + "\x00" + div; // left

  for (const i of sale.items) {
    const name = String(i.name).slice(0, W);
    out += enc(name) + "\n";
    const detail = `  ${i.qty} x ${money(i.price)}${i.discount ? ` (−${money(i.discount)})` : ""}`;
    out += enc(lr(detail, money(i.qty * i.price - (i.discount ?? 0)))) + "\n";
  }
  out += div;
  if (sale.discount > 0) out += enc(lr("Discount", `-${money(sale.discount)}`)) + "\n";
  out += enc(lr("Tax", money(sale.tax))) + "\n";
  out += ESC + "E" + "\x01" + enc(lr("TOTAL", money(sale.total))) + "\n" + ESC + "E" + "\x00";
  for (const t of sale.tenders) {
    const label = t.currency && t.amountForeign
      ? `${t.method} ${t.currency} ${money(t.amountForeign)}`
      : t.method;
    out += enc(lr(label, money(t.amount))) + "\n";
    if (t.tendered != null && t.method === "cash") {
      out += enc(lr("  tendered", money(t.tendered))) + "\n";
    }
  }
  if (sale.change > 0) out += enc(lr("Change", money(sale.change))) + "\n";
  out += div + ESC + "a" + "\x01" + enc("Thank you for your purchase") + "\n\n\n\n";
  out += GS + "V" + "\x42" + "\x00"; // partial cut
  return out;
}

/** Renders plain-text/HTML for e-receipt delivery. */
export function buildEReceiptHtml(sale: Parameters<typeof buildEscPosReceipt>[0]) {
  const money = (n: number) => `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
  const rows = sale.items
    .map((i) => `<tr><td>${i.name} ×${i.qty}</td><td style="text-align:right">${money(i.qty * i.price - (i.discount ?? 0))}</td></tr>`)
    .join("");
  const tenders = sale.tenders
    .map((t) => `<tr><td>${t.method}${t.tendered ? ` (tendered ${money(t.tendered)})` : ""}</td><td style="text-align:right">${money(t.amount)}</td></tr>`)
    .join("");
  return `<!doctype html><html><body style="font-family:sans-serif;max-width:420px;margin:auto">
<h2 style="text-align:center;margin-bottom:0">${sale.tenantName ?? "Receipt"}</h2>
<p style="text-align:center;color:#666">Receipt ${sale.receiptNo}<br>${(sale.createdAt ?? new Date().toISOString()).slice(0, 19).replace("T", " ")}</p>
<table style="width:100%">${rows}
<tr><td colspan="2"><hr></td></tr>
${sale.discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">-${money(sale.discount)}</td></tr>` : ""}
<tr><td>Tax</td><td style="text-align:right">${money(sale.tax)}</td></tr>
<tr><td><b>Total</b></td><td style="text-align:right"><b>${money(sale.total)}</b></td></tr>
${tenders}
${sale.change > 0 ? `<tr><td>Change</td><td style="text-align:right">${money(sale.change)}</td></tr>` : ""}
</table>
<p style="text-align:center;color:#666">Thank you for your purchase</p></body></html>`;
}

/**
 * Sends an e-receipt by email via the project's mailer. Returns the mailer
 * result; throws if the sale or contact is invalid.
 */
export async function sendEReceipt(input: {
  tenantSlug: string;
  saleId?: string;
  receiptNo?: string;
  email?: string;
  tenantName?: string;
}) {
  const sale = await getPosSale(input.tenantSlug, { id: input.saleId, receiptNo: input.receiptNo });
  if (!sale) throw new Error("Sale not found");
  if (sale.status !== "completed") throw new Error(`Sale is ${sale.status}`);

  const email = input.email ?? null;
  if (!email) throw new Error("An email address is required for e-receipts");

  const html = buildEReceiptHtml({
    receiptNo: sale.receiptNo,
    createdAt: sale.createdAt,
    items: sale.items ?? [],
    tenders: sale.tenders ?? [{ method: sale.paymentMethod, amount: sale.totalAmount }],
    total: sale.totalAmount, tax: sale.taxAmount,
    discount: sale.discountAmount, change: sale.changeDue ?? 0,
    customerName: sale.customerName,
    tenantName: input.tenantName,
  });

  const { sendEmail } = await import("@/lib/email");
  const result = await sendEmail({
    to: email,
    subject: `Receipt ${sale.receiptNo}`,
    html,
  });
  if (result.success) {
    await SQL`
      update pos_sales set ereceipt_sent_at = now(), ereceipt_to = ${email}
      where id = ${sale.id} and tenant_slug = ${input.tenantSlug}
    `.catch(() => {});
  }
  return result;
}
