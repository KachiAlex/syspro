// Per-event notification rendering: subject + HTML/text body + optional deep
// link into the tenant-admin app. Unknown event types fall back to a generic
// template so every event is still deliverable.

export interface RenderedNotification {
  subject: string;
  html: string;
  text: string;
  link?: string;
}

type Ctx = Record<string, any>;

const fmt = (n: any, currency = "₦") =>
  `${currency}${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

function shell(title: string, lines: string[], cta?: { label: string; url: string }) {
  const rows = lines.map((l) => `<p style="color:#475569;font-size:15px;margin:6px 0;">${l}</p>`).join("");
  const btn = cta
    ? `<div style="text-align:center;margin:28px 0;"><a href="${cta.url}" style="display:inline-block;padding:12px 28px;background:#E31E24;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">${cta.label}</a></div>`
    : "";
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <h2 style="color:#1e293b;">${title}</h2>
      ${rows}
      ${btn}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
      <p style="color:#94a3b8;font-size:12px;">Pisairtel ERP — automated notification, please do not reply.</p>
    </div>`;
  return html;
}

type Builder = (p: Ctx) => { subject: string; title: string; lines: string[]; link?: string; cta?: string };

const BUILDERS: Record<string, Builder> = {
  "approval.requested": (p) => ({
    subject: `Approval needed: ${p.entityType?.replace(/_/g, " ") ?? "document"} ${p.entityRef ?? ""}`,
    title: "Approval requested",
    lines: [
      `${p.requestedByName ?? p.requestedBy ?? "Someone"} submitted a <b>${p.entityType?.replace(/_/g, " ") ?? "document"}</b> for approval.`,
      p.entityRef ? `Reference: <b>${p.entityRef}</b>` : "",
      p.amount != null ? `Amount: <b>${fmt(p.amount)}</b>` : "",
      "Your action is required before it can take effect.",
    ].filter(Boolean),
    link: "/tenant-admin/approvals",
    cta: "Review & decide",
  }),
  "approval.decided": (p) => ({
    subject: `${p.entityType?.replace(/_/g, " ") ?? "Document"} ${p.entityRef ?? ""} was ${p.decision}`,
    title: `Approval ${p.decision}`,
    lines: [
      `Your <b>${p.entityType?.replace(/_/g, " ") ?? "document"}</b>${p.entityRef ? ` (${p.entityRef})` : ""} was <b>${p.decision}</b>`,
      p.decidedBy ? `by ${p.decidedBy}.` : ".",
      p.comments ? `Comment: ${p.comments}` : "",
    ].filter(Boolean),
    link: "/tenant-admin/approvals",
  }),
  "invoice.issued": (p) => ({
    subject: `Invoice ${p.invoiceNumber ?? ""} — ${fmt(p.amount)} due ${p.dueDate ?? ""}`,
    title: "Invoice issued",
    lines: [
      `Invoice <b>${p.invoiceNumber ?? p.invoiceId}</b> for <b>${fmt(p.amount)}</b> was issued${p.customerName ? ` to ${p.customerName}` : ""}.`,
      p.dueDate ? `Due date: <b>${p.dueDate}</b>` : "",
    ].filter(Boolean),
    link: "/tenant-admin/finance",
    cta: "View invoice",
  }),
  "payment.received": (p) => ({
    subject: `Payment received — ${fmt(p.amount)}${p.invoiceNumber ? ` on ${p.invoiceNumber}` : ""}`,
    title: "Payment received",
    lines: [
      `<b>${fmt(p.amount)}</b> was received${p.customerName ? ` from ${p.customerName}` : ""}${p.invoiceNumber ? ` against invoice <b>${p.invoiceNumber}</b>` : ""}.`,
      p.method ? `Method: ${p.method}` : "",
      p.reference ? `Reference: ${p.reference}` : "",
    ].filter(Boolean),
    link: "/tenant-admin/payments",
  }),
  "dunning.issued": (p) => ({
    subject: `Reminder L${p.level ?? ""}: invoice ${p.invoiceNumber ?? ""} is ${p.daysOverdue ?? ""} days overdue`,
    title: `Payment reminder — level ${p.level}`,
    lines: [
      `Invoice <b>${p.invoiceNumber}</b>${p.customerName ? ` (${p.customerName})` : ""} has an outstanding balance of <b>${fmt(p.balanceDue)}</b>.`,
      `It has been overdue for <b>${p.daysOverdue} days</b>.`,
      p.feeAmount ? `A late fee of <b>${fmt(p.feeAmount)}</b> has been posted.` : "",
      "Please arrange payment or contact us if this has already been settled.",
    ].filter(Boolean),
  }),
  "return.posted": (p) => ({
    subject: `${p.direction === "purchase" ? "Debit note" : "Credit note"} posted — ${fmt(p.totalAmount)}`,
    title: `${p.direction === "purchase" ? "Purchase" : "Sales"} return posted`,
    lines: [
      `A ${p.direction ?? "sales"} return for <b>${fmt(p.totalAmount)}</b> was posted against <b>${p.documentNo ?? p.sourceDocumentId}</b>.`,
      p.reason ? `Reason: ${p.reason}` : "",
      p.restock ? "Items were restocked into inventory." : "",
    ].filter(Boolean),
    link: "/tenant-admin/returns",
  }),
  "pos.shift_flagged": (p) => ({
    subject: `POS shift variance ${p.variance > 0 ? "+" : ""}${fmt(Math.abs(p.variance ?? 0))} on ${p.registerCode ?? "till"}`,
    title: "Shift closed over tolerance",
    lines: [
      `Shift on register <b>${p.registerCode ?? "?"}</b> closed with a cash variance of <b>${p.variance > 0 ? "+" : "−"}${fmt(Math.abs(p.variance ?? 0))}</b>.`,
      p.varianceReason ? `Reason given: ${p.varianceReason}` : "No reason recorded.",
      `Expected ${fmt(p.expectedCash)} · counted ${fmt(p.closingCounted)}.`,
    ].filter(Boolean),
    link: "/tenant-admin/pos",
  }),
  "leave.decided": (p) => ({
    subject: `Leave request ${p.status}`,
    title: `Leave ${p.status}`,
    lines: [
      `Your leave request${p.leaveType ? ` (${p.leaveType})` : ""} ${p.startDate ? `for ${p.startDate} → ${p.endDate}` : ""} was <b>${p.status}</b>.`,
      p.reviewedBy ? `Reviewed by ${p.reviewedBy}.` : "",
      p.reason ? `Reason: ${p.reason}` : "",
    ].filter(Boolean),
    link: "/tenant-admin/hr/leave",
  }),
  "payroll.run_posted": (p) => ({
    subject: `Payroll ${p.period ?? ""} posted — ${fmt(p.totalNet)}`,
    title: "Payroll run posted",
    lines: [
      `Payroll run for period <b>${p.period}</b> was posted for <b>${p.employeeCount ?? "?"}</b> employees.`,
      `Net pay: <b>${fmt(p.totalNet)}</b>.`,
    ].filter(Boolean),
    link: "/tenant-admin/hr/payroll",
  }),
  "payment_request.created": (p) => ({
    subject: `Payment link for invoice ${p.invoiceNumber ?? ""} — ${fmt(p.amount)}`,
    title: "Payment requested",
    lines: [
      `A payment of <b>${fmt(p.amount)}</b> is due on invoice <b>${p.invoiceNumber}</b>.`,
      `Pay securely here: ${p.linkUrl ?? ""}`,
    ].filter(Boolean),
  }),
  "payment_link.created": (p) => ({
    subject: `Payment link for invoice ${p.invoiceNumber ?? ""} — ${fmt(p.amount)}`,
    title: "Payment requested",
    lines: [
      `A payment of <b>${fmt(p.amount)}</b> is due on invoice <b>${p.invoiceNumber}</b>.`,
      `Pay securely here: ${p.linkUrl ?? ""}`,
    ].filter(Boolean),
  }),
  "expense.decided": (p) => ({
    subject: `Expense ${p.status}: ${p.description ?? ""}`,
    title: `Expense ${p.status}`,
    lines: [
      `Your expense${p.description ? ` "${p.description}"` : ""} for <b>${fmt(p.amount)}</b> was <b>${p.status}</b>${p.approverName ? ` by ${p.approverName}` : ""}.`,
      p.reason ? `Note: ${p.reason}` : "",
    ].filter(Boolean),
    link: "/tenant-admin/expenses",
  }),
  "budget.breached": (p) => ({
    subject: `Budget breach: ${p.budgetCode ?? "budget"} ${p.accountCode ?? ""} over by ${fmt(p.exceededBy)}`,
    title: "Budget overrun detected",
    lines: [
      `Budget <b>${p.budgetName ?? p.budgetCode}</b> account <b>${p.accountCode}</b> was exceeded.`,
      `Budgeted ${fmt(p.budgeted)} · consumed ${fmt(p.consumed)} · new spend ${fmt(p.requested)}.`,
      p.mode === "HARD_BLOCK" ? "The transaction was <b>blocked</b>." : "Spend continues under soft-warning mode.",
    ].filter(Boolean),
    link: "/tenant-admin/budget-vs-actual",
  }),
  "customer.credit_hold": (p) => ({
    subject: `Credit hold placed on ${p.customerName ?? p.customerCode ?? "customer"}`,
    title: "Customer on credit hold",
    lines: [
      `<b>${p.customerName ?? p.customerCode}</b> is now on credit hold — new invoices will be blocked at issuance.`,
      p.reason ? `Reason: ${p.reason}` : "",
    ].filter(Boolean),
    link: "/tenant-admin/credit-control",
  }),
  "po.created": (p) => ({
    subject: `Purchase order ${p.orderNumber ?? ""} created — ${fmt(p.total)}`,
    title: "Purchase order raised",
    lines: [
      `PO <b>${p.orderNumber}</b>${p.vendorName ? ` for ${p.vendorName}` : ""} totalling <b>${fmt(p.total)}</b> was created.`,
      p.status === "pending_approval" ? "It is awaiting approval before it can be sent." : "",
    ].filter(Boolean),
    link: "/tenant-admin/purchase-orders",
  }),
  "bill.created": (p) => ({
    subject: `Vendor bill ${p.billNumber ?? ""} received — ${fmt(p.total)}`,
    title: "Bill recorded",
    lines: [
      `Bill <b>${p.billNumber}</b>${p.vendorName ? ` from ${p.vendorName}` : ""} for <b>${fmt(p.total)}</b> was recorded.`,
      p.dueDate ? `Due: ${p.dueDate}` : "",
    ].filter(Boolean),
    link: "/tenant-admin/bills",
  }),
  "vendor_payment.made": (p) => ({
    subject: `Vendor payment ${p.paymentNumber ?? ""} — ${fmt(p.amount)}`,
    title: "Vendor payment recorded",
    lines: [
      `Payment <b>${p.paymentNumber}</b> of <b>${fmt(p.amount)}</b> was made${p.vendorName ? ` to ${p.vendorName}` : ""}.`,
      p.method ? `Method: ${p.method}` : "",
    ].filter(Boolean),
    link: "/tenant-admin/bills",
  }),
  "leave.requested": (p) => ({
    subject: `Leave request: ${p.employeeName ?? "Employee"} — ${p.leaveType ?? ""} ${p.startDate ?? ""}`,
    title: "Leave approval needed",
    lines: [
      `<b>${p.employeeName}</b> requested <b>${p.leaveType}</b> leave for <b>${p.days ?? "?"}</b> day(s), ${p.startDate} → ${p.endDate}.`,
      p.reason ? `Reason: ${p.reason}` : "",
    ].filter(Boolean),
    link: "/tenant-admin/hr/leave",
    cta: "Review request",
  }),
  "wo.completed": (p) => ({
    subject: `Work order ${p.workOrderNo ?? p.workOrderId ?? ""} completed`,
    title: "Work order completed",
    lines: [
      `Work order <b>${p.workOrderNo ?? p.workOrderId}</b>${p.itemName ? ` for ${p.itemName}` : ""} completed${p.quantity ? ` — ${p.quantity} units` : ""}.`,
    ].filter(Boolean),
    link: "/tenant-admin/manufacturing",
  }),
  "qc.failed": (p) => ({
    subject: `QC failure on work order ${p.workOrderId ?? ""} — ${p.unitsRejected ?? "?"} rejected`,
    title: "Quality inspection failed",
    lines: [
      `Inspection on work order <b>${p.workOrderId}</b> marked <b>failed</b>: ${p.unitsRejected ?? "?"} of ${p.unitsInspected ?? "?"} units rejected.`,
      p.defectTypes?.length ? `Defects: ${p.defectTypes.join(", ")}` : "",
      p.notes ? `Notes: ${p.notes}` : "",
    ].filter(Boolean),
    link: "/tenant-admin/manufacturing",
  }),
  "stock.low": (p) => ({
    subject: `Low stock: ${p.itemName ?? p.sku}`,
    title: "Stock below reorder level",
    lines: [
      `<b>${p.itemName ?? p.sku}</b> (${p.sku}) is at <b>${p.currentStock}</b> units — reorder level is ${p.reorderLevel}.`,
      "Consider raising a purchase order.",
    ].filter(Boolean),
    link: "/tenant-admin/inventory",
    cta: "View inventory",
  }),
};

export function renderNotification(eventType: string, payload: Ctx): RenderedNotification {
  const b = BUILDERS[eventType];
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  if (!b) {
    const subject = `${eventType} notification`;
    const lines = Object.entries(payload ?? {})
      .filter(([, v]) => ["string", "number"].includes(typeof v))
      .slice(0, 8)
      .map(([k, v]) => `${k.replace(/_/g, " ")}: <b>${v}</b>`);
    return {
      subject,
      html: shell(subject, lines.length ? lines : ["An event occurred."]),
      text: `${subject}\n\n${Object.entries(payload ?? {}).slice(0, 8).map(([k, v]) => `${k}: ${v}`).join("\n")}`,
    };
  }
  const t = b(payload ?? {});
  const url = t.link ? base + t.link : undefined;
  return {
    subject: t.subject,
    html: shell(t.title, t.lines, t.cta && url ? { label: t.cta, url } : undefined),
    text: `${t.title}\n\n${t.lines.map((l) => l.replace(/<[^>]+>/g, "")).join("\n")}${url ? `\n\n${url}` : ""}`,
    link: t.link,
  };
}
