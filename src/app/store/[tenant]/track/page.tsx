"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Package, AlertCircle, ArrowLeft } from "lucide-react";

const fmt = (n: number) => `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

const STATUS_STEPS = ["pending", "confirmed", "fulfilled"];

function TrackOrder() {
  const params = useParams();
  const tenant = String(params.tenant);
  const searchParams = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams.get("orderNumber") ?? "");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const lookup = async (num = orderNumber, em = email) => {
    if (!num.trim()) { setError("Enter your order number"); return; }
    setLoading(true); setError(null); setOrder(null);
    const params = new URLSearchParams({ orderNumber: num.trim() });
    if (em.trim()) params.set("email", em.trim());
    const res = await fetch(`/api/storefront/${encodeURIComponent(tenant)}/orders?${params}`);
    const body = await res.json().catch(() => ({}));
    setLoading(false); setSearched(true);
    if (!res.ok) { setError(body.error ?? "Order not found"); return; }
    setOrder(body.order);
  };

  useEffect(() => {
    if (searchParams.get("orderNumber")) lookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusIdx = order ? STATUS_STEPS.indexOf((order.status ?? "").toLowerCase()) : -1;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <Link href={`/store/${tenant}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to store
        </Link>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h1 className="text-lg font-bold text-gray-900 mb-4">Track your order</h1>
          <div className="space-y-3">
            <input
              value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="Order number (e.g. WEB-ABC123)"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
            />
            <input
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Email used at checkout"
              type="email"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
            />
            <button
              onClick={() => lookup()} disabled={loading}
              className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Look up order"}
            </button>
          </div>
        </div>

        {error && searched && (
          <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {order && (
          <div className="mt-4 bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="font-mono font-semibold text-gray-900">{order.orderNumber}</p>
                <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleString()}</p>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full font-medium capitalize ${
                order.status === "cancelled" ? "bg-red-100 text-red-700"
                : order.status === "fulfilled" || order.status === "confirmed" ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
              }`}>{order.status}</span>
            </div>

            {order.status !== "cancelled" && (
              <div className="flex items-center mb-6">
                {STATUS_STEPS.map((step, i) => (
                  <React.Fragment key={step}>
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                        i <= statusIdx ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"
                      }`}>
                        {i <= statusIdx ? "✓" : i + 1}
                      </div>
                      <span className={`text-[10px] mt-1 capitalize ${i <= statusIdx ? "text-blue-600 font-medium" : "text-gray-400"}`}>
                        {step}
                      </span>
                    </div>
                    {i < STATUS_STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 mb-4 ${i < statusIdx ? "bg-blue-600" : "bg-gray-200"}`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}

            <div className="divide-y divide-gray-100 text-sm">
              {(order.items ?? []).map((it: any, i: number) => (
                <div key={i} className="py-2 flex justify-between">
                  <span className="text-gray-700">{it.name ?? it.sku} × {it.quantity}</span>
                  <span className="text-gray-900">{fmt(it.amount ?? it.unitPrice * it.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-bold text-gray-900 pt-3 border-t border-gray-200 mt-2">
              <span>Total</span><span>{fmt(order.total)}</span>
            </div>

            {order.status === "pending" && (
              <p className="mt-4 text-xs text-gray-500 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> Your order is awaiting confirmation.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
      <TrackOrder />
    </Suspense>
  );
}
