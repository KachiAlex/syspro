"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Search, ShoppingCart, Trash2, Plus, Minus, CheckCircle, AlertCircle, Package } from "lucide-react";

interface Product {
  sku: string; name: string; category: string; description: string;
  price: number; inStock: number;
}
interface CartItem { sku: string; name: string; price: number; quantity: number; inStock: number }

const fmt = (n: number) => `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

function Storefront() {
  const params = useParams();
  const tenant = String(params.tenant);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ orderNumber: string; total: number } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const cartKey = `storefront-cart-${tenant}`;

  useEffect(() => {
    document.title = `${tenant} — Store`;
    (async () => {
      const res = await fetch(`/api/storefront/${encodeURIComponent(tenant)}/catalog`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(body.error ?? "Failed to load catalog");
      else setProducts(body.products ?? []);
    })();
    try {
      const saved = localStorage.getItem(cartKey);
      if (saved) setCart(JSON.parse(saved));
    } catch { /* ignore corrupt cart */ }
  }, [tenant, cartKey]);

  useEffect(() => {
    try { localStorage.setItem(cartKey, JSON.stringify(cart)); } catch { /* quota */ }
  }, [cart, cartKey]);

  const categories = useMemo(
    () => Array.from(new Set((products ?? []).map((p) => p.category).filter(Boolean))),
    [products]
  );
  const visible = useMemo(
    () => (products ?? []).filter((p) =>
      (!category || p.category === category) &&
      (!search || p.name.toLowerCase().includes(search.toLowerCase()))),
    [products, category, search]
  );
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const add = (p: Product) => {
    setCart((prev) => {
      const i = prev.findIndex((c) => c.sku === p.sku);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: Math.min(next[i].quantity + 1, p.inStock) };
        return next;
      }
      return [...prev, { sku: p.sku, name: p.name, price: p.price, quantity: 1, inStock: p.inStock }];
    });
    setCartOpen(true);
  };
  const setQty = (sku: string, delta: number) =>
    setCart((prev) => prev
      .map((c) => c.sku === sku ? { ...c, quantity: Math.min(Math.max(1, c.quantity + delta), c.inStock) } : c));
  const remove = (sku: string) => setCart((prev) => prev.filter((c) => c.sku !== sku));

  const checkout = async () => {
    if (!form.name.trim()) { setSubmitError("Your name is required"); return; }
    setSubmitting(true); setSubmitError(null);
    const res = await fetch(`/api/storefront/${encodeURIComponent(tenant)}/orders`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: form.name.trim(),
        customerEmail: form.email.trim() || undefined,
        customerPhone: form.phone.trim() || undefined,
        notes: form.notes.trim() || undefined,
        items: cart.map((c) => ({ sku: c.sku, quantity: c.quantity })),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) { setSubmitError(body.error ?? "Checkout failed"); return; }
    setConfirmation({ orderNumber: body.orderNumber, total: body.total });
    setCart([]);
    localStorage.removeItem(cartKey);
  };

  if (confirmation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center max-w-md">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900">Order placed</h1>
          <p className="text-sm text-gray-600 mt-2">
            Order <span className="font-mono font-semibold">{confirmation.orderNumber}</span> · {fmt(confirmation.total)}
          </p>
          <p className="text-xs text-gray-500 mt-3">We&apos;ll confirm your order shortly. Save your order number to track it.</p>
          <Link
            href={`/store/${tenant}/track?orderNumber=${confirmation.orderNumber}${form.email ? `&email=${encodeURIComponent(form.email)}` : ""}`}
            className="inline-block mt-6 px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            Track order
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 capitalize">{tenant.replace(/[-_]/g, " ")}</h1>
          <div className="flex items-center gap-3">
            <Link href={`/store/${tenant}/track`} className="text-sm text-gray-600 hover:text-gray-900">Track order</Link>
            <button
              onClick={() => setCartOpen(true)}
              className="relative flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              <ShoppingCart className="w-4 h-4" />
              Cart
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-gray-300 text-sm"
            />
          </div>
          <button onClick={() => setCategory(null)}
            className={`px-3 py-2 rounded-lg text-sm ${!category ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-700"}`}>All</button>
          {categories.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-3 py-2 rounded-lg text-sm capitalize ${category === c ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-700"}`}>{c}</button>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm mb-6">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}
        {!products && !error && (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        )}
        {products && !visible.length && (
          <div className="text-center py-20 text-gray-500">
            <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            No products available.
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {visible.map((p) => (
            <div key={p.sku} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
              <p className="text-sm font-medium text-gray-900">{p.name}</p>
              <p className="text-xs text-gray-500 capitalize mt-0.5">{p.category}</p>
              {p.description && <p className="text-xs text-gray-500 mt-2 line-clamp-2 flex-1">{p.description}</p>}
              <div className="mt-3 flex items-center justify-between">
                <span className="font-bold text-gray-900">{fmt(p.price)}</span>
                <button
                  onClick={() => add(p)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{p.inStock} in stock</p>
            </div>
          ))}
        </div>
      </main>

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 bg-black/40 z-20" onClick={() => setCartOpen(false)}>
          <div
            className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Your cart ({cartCount})</h2>
              <button onClick={() => setCartOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {cart.map((c) => (
                <div key={c.sku} className="px-5 py-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-500">{fmt(c.price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setQty(c.sku, -1)} className="p-1 rounded bg-gray-100"><Minus className="w-3 h-3" /></button>
                    <span className="text-sm w-6 text-center">{c.quantity}</span>
                    <button onClick={() => setQty(c.sku, 1)} className="p-1 rounded bg-gray-100"><Plus className="w-3 h-3" /></button>
                  </div>
                  <span className="text-sm font-medium w-20 text-right">{fmt(c.price * c.quantity)}</span>
                  <button onClick={() => remove(c.sku)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              {!cart.length && <p className="text-sm text-gray-400 text-center py-16">Cart is empty</p>}
            </div>
            <div className="border-t border-gray-200 p-5">
              <div className="flex justify-between font-bold text-gray-900 mb-4">
                <span>Total</span><span>{fmt(cartTotal)}</span>
              </div>
              <button
                onClick={() => { setCartOpen(false); setCheckingOut(true); }}
                disabled={!cart.length}
                className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-40"
              >
                Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout modal */}
      {checkingOut && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Checkout</h2>
            <div className="space-y-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name *" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email (for order tracking)" type="email" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Phone" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" />
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Delivery notes (optional)" rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm" />
            </div>
            <div className="flex justify-between font-bold text-gray-900 my-4">
              <span>Order total</span><span>{fmt(cartTotal)}</span>
            </div>
            {submitError && <p className="text-sm text-red-600 mb-3">{submitError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setCheckingOut(false)}
                className="flex-1 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium">Back</button>
              <button onClick={checkout} disabled={submitting || !cart.length}
                className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin inline" /> : `Place order · ${fmt(cartTotal)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StorefrontPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}>
      <Storefront />
    </Suspense>
  );
}
