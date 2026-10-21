"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle, FileText, Printer, CheckCircle } from "lucide-react";

const fmt = (n: number, currency = "₦") =>
  `${currency}${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

function StatusBadge({ status }: { status: string }) {
  const s = (status ?? "").toLowerCase();
  const cls = s === "paid" || s === "confirmed"
    ? "bg-green-100 text-green-700"
    : s === "overdue" || s === "cancelled" || s === "void"
    ? "bg-red-100 text-red-700"
    : s === "draft" || s === "pending"
    ? "bg-gray-100 text-gray-600"
    : "bg-blue-100 text-blue-700";
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${cls}`}>{status}</span>;
}

function PortalStatement() {
  const params = useParams();
  const token = String(params.token);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/portal/${encodeURIComponent(token)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(body.error ?? "This portal link is invalid or has expired.");
      else {
        setData(body);
        document.title = `${body.partyName} — Statement`;
      }
      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center max-w-md">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-gray-900 mb-1">Link unavailable</h1>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const isCustomer = data.partyType === "customer";

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.partyName}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {isCustomer ? "Customer statement" : "Vendor statement"} · {data.tenantSlug}
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 print:hidden"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {isCustomer ? (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs text-gray-500">Total invoiced</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{fmt(data.totals.invoiced)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs text-gray-500">Paid</p>
                <p className="text-xl font-bold text-green-600 mt-1">{fmt(data.totals.paid)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs text-gray-500">Outstanding</p>
                <p className="text-xl font-bold text-amber-600 mt-1">{fmt(data.totals.outstanding)}</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs text-gray-500">Total billed</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{fmt(data.totals.billed)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs text-gray-500">Outstanding</p>
                <p className="text-xl font-bold text-amber-600 mt-1">{fmt(data.totals.outstanding)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs text-gray-500">Purchase orders</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{data.purchaseOrders?.length ?? 0}</p>
              </div>
            </>
          )}
        </div>

        {/* Documents */}
        {isCustomer ? (
          <>
            <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <h2 className="font-semibold text-gray-900">Invoices</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="px-5 py-2">Invoice</th><th className="px-5 py-2">Issued</th><th className="px-5 py-2">Due</th>
                    <th className="px-5 py-2 text-right">Amount</th><th className="px-5 py-2 text-right">Balance</th><th className="px-5 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data.invoices ?? []).map((i: any) => (
                    <tr key={i.id}>
                      <td className="px-5 py-3 font-medium text-gray-900">{i.invoiceNumber}</td>
                      <td className="px-5 py-3 text-gray-600">{String(i.issuedDate ?? "").slice(0, 10)}</td>
                      <td className="px-5 py-3 text-gray-600">{String(i.dueDate ?? "").slice(0, 10)}</td>
                      <td className="px-5 py-3 text-right text-gray-900">{fmt(i.amount, i.currency === "NGN" ? "₦" : i.currency)}</td>
                      <td className="px-5 py-3 text-right text-gray-900">{fmt(i.balanceDue, i.currency === "NGN" ? "₦" : i.currency)}</td>
                      <td className="px-5 py-3"><StatusBadge status={i.status} /></td>
                    </tr>
                  ))}
                  {!data.invoices?.length && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No invoices</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-gray-400" />
                <h2 className="font-semibold text-gray-900">Payments received</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="px-5 py-2">Reference</th><th className="px-5 py-2">Date</th>
                    <th className="px-5 py-2">Method</th><th className="px-5 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data.payments ?? []).map((p: any) => (
                    <tr key={p.id}>
                      <td className="px-5 py-3 font-medium text-gray-900">{p.reference}</td>
                      <td className="px-5 py-3 text-gray-600">{String(p.date ?? "").slice(0, 10)}</td>
                      <td className="px-5 py-3 text-gray-600 capitalize">{(p.method ?? "").replace("_", " ")}</td>
                      <td className="px-5 py-3 text-right text-gray-900">{fmt(p.amount)}</td>
                    </tr>
                  ))}
                  {!data.payments?.length && <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">No payments yet</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <h2 className="font-semibold text-gray-900">Bills</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="px-5 py-2">Bill</th><th className="px-5 py-2">Date</th><th className="px-5 py-2">Due</th>
                    <th className="px-5 py-2 text-right">Total</th><th className="px-5 py-2 text-right">Balance</th><th className="px-5 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data.bills ?? []).map((b: any) => (
                    <tr key={b.id}>
                      <td className="px-5 py-3 font-medium text-gray-900">{b.billNumber}</td>
                      <td className="px-5 py-3 text-gray-600">{String(b.billDate ?? "").slice(0, 10)}</td>
                      <td className="px-5 py-3 text-gray-600">{String(b.dueDate ?? "").slice(0, 10)}</td>
                      <td className="px-5 py-3 text-right text-gray-900">{fmt(b.total, b.currency === "NGN" ? "₦" : b.currency)}</td>
                      <td className="px-5 py-3 text-right text-gray-900">{fmt(b.balanceDue, b.currency === "NGN" ? "₦" : b.currency)}</td>
                      <td className="px-5 py-3"><StatusBadge status={b.status} /></td>
                    </tr>
                  ))}
                  {!data.bills?.length && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No bills</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <h2 className="font-semibold text-gray-900">Purchase orders</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="px-5 py-2">PO</th><th className="px-5 py-2">Date</th>
                    <th className="px-5 py-2 text-right">Total</th><th className="px-5 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data.purchaseOrders ?? []).map((p: any) => (
                    <tr key={p.id}>
                      <td className="px-5 py-3 font-medium text-gray-900">{p.poNumber}</td>
                      <td className="px-5 py-3 text-gray-600">{String(p.orderDate ?? "").slice(0, 10)}</td>
                      <td className="px-5 py-3 text-right text-gray-900">{fmt(p.total)}</td>
                      <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                  {!data.purchaseOrders?.length && <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">No purchase orders</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">
          This is a read-only statement. Contact {data.tenantSlug} for any discrepancies.
        </p>
      </div>
    </div>
  );
}

export default function PortalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
      <PortalStatement />
    </Suspense>
  );
}
