"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote, Clock, Loader2, Minus, Pause, Play, Plus, Printer, RotateCcw,
  ScanBarcode, Search, ShoppingCart, Trash2, AlertCircle, Users, X, Wallet,
} from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

interface Product {
  id: string; sku: string; name: string; category: string;
  quantity: number; unitPrice: number; status: string; tracking?: string;
}
interface CartLine {
  product: Product; quantity: number; unitPrice: number;
  discountPct: number; serialNos: string; lotNo: string;
}
interface Shift {
  id: string; status: string; registerId: string | null;
  openedBy: string | null; openedAt: string;
  openingFloat: number; closingCounted?: number | null;
  expectedCash?: number | null; variance?: number | null; flagged?: boolean;
}
interface Register { id: string; code: string; name: string }
interface PosConfig {
  vatRate: number; cashRoundingStep: number; cardFeePct: number;
  varianceTolerance: number;
  loyalty: { enabled: boolean; earnDivisor: number; redeemValue: number };
}
interface Tender { method: string; amount: number; tendered?: number }
interface Customer { customerCode: string; name: string }
interface ReceiptData {
  receiptNo: string; invoiceNumber?: string; total: number;
  lines: { name: string; qty: number; amount: number }[];
  net: number; tax: number; discount: number; rounding: number;
  tenders: Tender[]; change: number; customer?: string | null;
}

const fmt = (n: number) => `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
const METHODS = ["cash", "pos", "bank_transfer", "mobile_money"] as const;
const methodLabel = (m: string) => (m === "pos" ? "POS" : m === "bank_transfer" ? "Transfer" : m === "mobile_money" ? "MoMo" : m === "store_credit" ? "Credit" : "Cash");
const OFFLINE_KEY = "pos_offline_queue";

export default function PosPage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<"sell" | "shift" | "today">("sell");
  const [shift, setShift] = useState<Shift | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [registers, setRegisters] = useState<Register[]>([]);
  const [registerId, setRegisterId] = useState<string>("");
  const [config, setConfig] = useState<PosConfig | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartKey, setCartKey] = useState(() => crypto.randomUUID());
  const [search, setSearch] = useState("");
  const [scanInput, setScanInput] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerCode, setCustomerCode] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [loyalty, setLoyalty] = useState<{ points: number; redeemValue: number } | null>(null);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [orderDiscount, setOrderDiscount] = useState<{ amount?: number; pct?: number; reason: string } | null>(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [tenderOpen, setTenderOpen] = useState(false);
  const [tenders, setTenders] = useState<Tender[]>([{ method: "cash", amount: 0 }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [eReceiptEmail, setEReceiptEmail] = useState("");
  const [eReceiptBusy, setEReceiptBusy] = useState(false);
  const [eReceiptSent, setEReceiptSent] = useState(false);
  const [openingFloat, setOpeningFloat] = useState("0");
  const [closingCounted, setClosingCounted] = useState("");
  const [varianceReason, setVarianceReason] = useState("");
  const [revealExpected, setRevealExpected] = useState(false);
  const [shiftHistory, setShiftHistory] = useState<Shift[]>([]);
  const [shiftSummary, setShiftSummary] = useState<any>(null);
  const [cashMove, setCashMove] = useState<{ type: string; amount: string; reason: string } | null>(null);
  const [heldList, setHeldList] = useState<any[]>([]);
  const [heldOpen, setHeldOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReceiptNo, setReturnReceiptNo] = useState("");
  const [returnSale, setReturnSale] = useState<any>(null);
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [returnMethod, setReturnMethod] = useState("cash");
  const [returnReason, setReturnReason] = useState("");
  const [today, setToday] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastClose, setLastClose] = useState<any>(null);

  useEffect(() => {
    if (receipt) { setEReceiptEmail(""); setEReceiptSent(false); }
  }, [receipt]);

  const api = useCallback(
    (path: string, init?: RequestInit) =>
      fetch(`${path}${path.includes("?") ? "&" : "?"}tenantSlug=${encodeURIComponent(tenantSlug)}`, init),
    [tenantSlug]
  );

  // ---------- loaders ----------
  const loadShift = useCallback(async (reg?: string) => {
    setShiftLoading(true);
    const res = await api(`/api/pos/shifts?current=1${reg ? `&registerId=${reg}` : ""}`);
    const data = await res.json().catch(() => ({}));
    setShift(data.shift ?? null);
    setShiftLoading(false);
  }, [api]);

  const loadProducts = useCallback(async () => {
    const res = await api("/api/inventory?limit=500");
    const data = await res.json().catch(() => ({}));
    setProducts(data.items ?? []);
  }, [api]);

  const loadRegisters = useCallback(async () => {
    const res = await api("/api/pos/registers");
    const data = await res.json().catch(() => ({}));
    const regs: Register[] = data.registers ?? [];
    setRegisters(regs);
    const saved = localStorage.getItem("pos_register_id");
    const valid = regs.find((r) => r.id === saved);
    const first = valid?.id ?? regs[0]?.id ?? "";
    setRegisterId(first);
    if (first) localStorage.setItem("pos_register_id", first);
    return first;
  }, [api]);

  const loadConfig = useCallback(async () => {
    const res = await api("/api/pos/config");
    if (res.ok) setConfig(await res.json().catch(() => null));
  }, [api]);

  const loadCustomers = useCallback(async () => {
    const res = await api("/api/finance/customers?limit=200");
    const data = await res.json().catch(() => ({}));
    setCustomers((data.customers ?? data ?? []).map((c: any) => ({
      customerCode: c.customerCode ?? c.customer_code, name: c.name,
    })).filter((c: Customer) => c.customerCode));
  }, [api]);

  const loadShiftData = useCallback(async () => {
    const [histRes, sumRes] = await Promise.all([
      api("/api/pos/shifts"),
      shift ? api(`/api/pos/shifts/${shift.id}`) : Promise.resolve(null),
    ]);
    const hist = await histRes.json().catch(() => ({}));
    setShiftHistory(hist.shifts ?? []);
    if (sumRes) setShiftSummary(await sumRes.json().catch(() => null));
  }, [api, shift]);

  const loadToday = useCallback(async () => {
    const [sumRes, salesRes] = await Promise.all([
      api("/api/pos/sales?summary=daily"),
      api("/api/pos/sales?limit=30"),
    ]);
    setToday(await sumRes.json().catch(() => null));
    const s = await salesRes.json().catch(() => ({}));
    setRecent(s.sales ?? []);
  }, [api]);

  const loadHeld = useCallback(async () => {
    const res = await api(`/api/pos/held${registerId ? `?registerId=${registerId}` : ""}`);
    const data = await res.json().catch(() => ({}));
    setHeldList(data.held ?? []);
  }, [api, registerId]);

  const loadLoyalty = useCallback(async (code: string) => {
    if (!code) { setLoyalty(null); return; }
    const res = await api(`/api/pos/loyalty?customerCode=${encodeURIComponent(code)}`);
    const data = await res.json().catch(() => null);
    setLoyalty(data && data.points != null ? { points: data.points, redeemValue: data.redeemValue } : null);
  }, [api]);

  useEffect(() => {
    (async () => {
      await loadConfig();
      await loadCustomers();
      const reg = await loadRegisters();
      await loadShift(reg || undefined);
      loadProducts();
    })();
    try {
      setOfflineQueue(JSON.parse(localStorage.getItem(OFFLINE_KEY) ?? "[]"));
    } catch { setOfflineQueue([]); }
  }, [loadConfig, loadCustomers, loadRegisters, loadShift, loadProducts]);

  useEffect(() => { if (tab === "shift") loadShiftData(); if (tab === "today") loadToday(); if (tab === "sell") loadHeld(); }, [tab, loadShiftData, loadToday, loadHeld]);
  useEffect(() => { if (customerCode) loadLoyalty(customerCode); else setLoyalty(null); }, [customerCode, loadLoyalty]);

  const switchRegister = async (id: string) => {
    setRegisterId(id);
    localStorage.setItem("pos_register_id", id);
    await loadShift(id);
  };

  // ---------- cart math (estimate — server is authoritative) ----------
  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))),
    [products]
  );
  const visible = useMemo(
    () => products.filter((p) =>
      (!category || p.category === category) &&
      (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))),
    [products, category, search]
  );

  const vatRate = config?.vatRate ?? 0;
  const linesNet = cart.reduce((s, l) => s + Math.max(0, l.quantity * l.unitPrice * (1 - l.discountPct / 100)), 0);
  const orderDisc = orderDiscount ? Math.min(linesNet, (orderDiscount.amount ?? 0) + (linesNet * (orderDiscount.pct ?? 0)) / 100) : 0;
  const loyaltyDisc = redeemPoints > 0 && config ? Math.min(linesNet - orderDisc, redeemPoints * config.loyalty.redeemValue) : 0;
  const estNet = Math.max(0, linesNet - orderDisc - loyaltyDisc);
  const estTax = Math.round(estNet * (vatRate / 100) * 100) / 100;
  let estTotal = estNet + estTax;
  const roundingStep = config?.cashRoundingStep ?? 0;
  const allCash = tenders.every((t) => t.method === "cash");
  const estRounding = roundingStep > 0 && allCash ? Math.round(estTotal / roundingStep) * roundingStep - estTotal : 0;
  estTotal += estRounding;
  const total = Math.round(estTotal * 100) / 100;

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.product.sku === p.sku);
      if (i >= 0) {
        const next = [...prev];
        const newQty = next[i].quantity + 1;
        if (p.quantity > 0 && newQty > p.quantity) return prev; // oversell guard
        next[i] = { ...next[i], quantity: newQty };
        return next;
      }
      if (p.quantity <= 0) return prev;
      return [...prev, { product: p, quantity: 1, unitPrice: p.unitPrice, discountPct: 0, serialNos: "", lotNo: "" }];
    });
  };
  const setQty = (sku: string, delta: number) =>
    setCart((prev) => prev.map((l) => l.product.sku === sku
      ? { ...l, quantity: Math.min(Math.max(1, l.quantity + delta), Math.max(1, l.product.quantity)) } : l));
  const setLine = (sku: string, patch: Partial<CartLine>) =>
    setCart((prev) => prev.map((l) => l.product.sku === sku ? { ...l, ...patch } : l));
  const removeLine = (sku: string) => setCart((prev) => prev.filter((l) => l.product.sku !== sku));

  const onScanEnter = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || !scanInput.trim()) return;
    const q = scanInput.trim().toLowerCase();
    const p = products.find((x) => x.sku.toLowerCase() === q);
    if (p) { addToCart(p); setScanInput(""); }
    else setError(`No product with SKU "${scanInput.trim()}"`);
  };

  // ---------- shift actions ----------
  const openShiftNow = async () => {
    setBusy(true); setError(null);
    const res = await api("/api/pos/shifts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingFloat: Number(openingFloat) || 0, registerId: registerId || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Failed to open shift"); return; }
    setShift(data.shift);
  };

  const closeShiftNow = async () => {
    if (!shift) return;
    setBusy(true); setError(null);
    const res = await api(`/api/pos/shifts/${shift.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "close", closingCounted: Number(closingCounted) || 0,
        varianceReason: varianceReason || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Failed to close shift"); return; }
    setLastClose(data.shift);
    setShift(null); setClosingCounted(""); setVarianceReason(""); setRevealExpected(false);
    loadShiftData();
  };

  const submitCashMove = async () => {
    if (!cashMove || !shift) return;
    setBusy(true); setError(null);
    const res = await api("/api/pos/cash-movements", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId: shift.id, type: cashMove.type, amount: Number(cashMove.amount), reason: cashMove.reason || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Cash movement failed"); return; }
    setCashMove(null);
    loadShiftData();
  };

  // ---------- held sales ----------
  const parkSale = async () => {
    if (!cart.length) return;
    const label = window.prompt("Label for this held sale", customerName || "Held sale");
    if (label === null) return;
    const res = await api("/api/pos/held", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, registerId: registerId || undefined, customerCode: customerCode || undefined, cart }),
    });
    if (res.ok) { setCart([]); setCartKey(crypto.randomUUID()); setCustomerCode(""); setCustomerName(""); loadHeld(); }
    else setError((await res.json().catch(() => ({}))).error ?? "Failed to park sale");
  };

  const resumeSale = async (held: any) => {
    const lines: CartLine[] = [];
    for (const l of held.cart ?? []) {
      const p = products.find((x) => x.sku === l.product?.sku) ?? l.product;
      if (p) lines.push({ product: p, quantity: l.quantity, unitPrice: l.unitPrice, discountPct: l.discountPct ?? 0, serialNos: l.serialNos ?? "", lotNo: l.lotNo ?? "" });
    }
    setCart(lines);
    if (held.customerCode) setCustomerCode(held.customerCode);
    await api(`/api/pos/held?id=${held.id}`, { method: "DELETE" });
    setHeldOpen(false);
    loadHeld();
  };

  // ---------- returns ----------
  const lookupReturn = async () => {
    setError(null); setReturnSale(null);
    const res = await api(`/api/pos/sales?receipt=${encodeURIComponent(returnReceiptNo.trim())}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.sale) { setError(data.error ?? "Sale not found"); return; }
    setReturnSale(data.sale);
    setReturnQty({});
  };

  const submitReturn = async () => {
    if (!returnSale) return;
    const items = Object.entries(returnQty)
      .filter(([, q]) => q > 0)
      .map(([sku, q]) => ({ sku, quantity: q }));
    if (!items.length) { setError("Select at least one item to return"); return; }
    setBusy(true); setError(null);
    const res = await api("/api/pos/returns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saleId: returnSale.id, items, refundMethod: returnMethod, reason: returnReason || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Return failed"); return; }
    setReturnOpen(false); setReturnSale(null); setReturnReceiptNo("");
    loadProducts(); loadToday();
  };

  // ---------- checkout ----------
  const buildPayload = () => ({
    items: cart.map((l) => ({
      sku: l.product.sku, quantity: l.quantity,
      unitPrice: l.unitPrice !== l.product.unitPrice ? l.unitPrice : undefined,
      discountPct: l.discountPct || undefined,
      serialNos: l.product.tracking === "serial"
        ? l.serialNos.split(/[,\n]/).map((s) => s.trim()).filter(Boolean) : undefined,
      lotNo: l.product.tracking === "batch" ? l.lotNo.trim() : undefined,
    })),
    tenders: tenders.map((t) => ({ method: t.method, amount: t.amount, tendered: t.tendered })),
    customerCode: customerCode || undefined,
    customerName: customerName || undefined,
    registerId: registerId || undefined,
    discount: orderDiscount ?? undefined,
    loyaltyRedeemPoints: redeemPoints > 0 ? redeemPoints : undefined,
    idempotencyKey: cartKey,
  });

  const postSale = async (payload: any) => {
    const res = await api("/api/pos/sales", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Checkout failed");
    return res.json();
  };

  const checkout = async () => {
    if (!cart.length || busy) return;
    for (const l of cart) {
      if (l.product.tracking === "serial") {
        const serials = l.serialNos.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
        if (serials.length !== l.quantity) {
          setError(`"${l.product.name}" requires exactly ${l.quantity} serial number(s)`);
          return;
        }
      }
      if (l.product.tracking === "batch" && !l.lotNo.trim()) {
        setError(`"${l.product.name}" requires a lot number`);
        return;
      }
    }
    setBusy(true); setError(null);
    const payload = buildPayload();
    try {
      const data = await postSale(payload);
      setReceipt({
        receiptNo: data.receiptNo, invoiceNumber: data.invoiceNumber, total: data.total,
        lines: cart.map((l) => ({ name: l.product.name, qty: l.quantity, amount: l.quantity * l.unitPrice })),
        net: estNet, tax: estTax, discount: linesNet - estNet, rounding: estRounding,
        tenders, change: data.change ?? 0,
        customer: customerName || customers.find((c) => c.customerCode === customerCode)?.name,
      });
      setCart([]); setCartKey(crypto.randomUUID());
      setCustomerCode(""); setCustomerName(""); setOrderDiscount(null); setRedeemPoints(0);
      setTenderOpen(false); setTenders([{ method: "cash", amount: 0 }]);
      loadProducts();
    } catch (err: any) {
      // Network failure — queue for replay (idempotency key makes this safe).
      if (err instanceof TypeError || /fetch|network|Failed to fetch/i.test(err.message ?? "")) {
        const queue = [...offlineQueue, payload];
        setOfflineQueue(queue);
        localStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
        setError("Offline — sale queued and will sync when connection returns");
      } else {
        setError(err.message);
      }
    }
    setBusy(false);
  };

  const syncOffline = async () => {
    if (syncing || !offlineQueue.length) return;
    setSyncing(true); setError(null);
    const remaining: any[] = [];
    for (const p of offlineQueue) {
      try { await postSale(p); } catch (err: any) {
        if (err instanceof TypeError || /fetch|network|Failed to fetch/i.test(err.message ?? "")) {
          remaining.push(p, ...offlineQueue.slice(offlineQueue.indexOf(p) + 1));
          break;
        }
        // Business-rule rejection — drop from queue, surface the error.
        setError(`Queued sale ${p.idempotencyKey?.slice(0, 8)}… rejected: ${err.message}`);
      }
    }
    setOfflineQueue(remaining);
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(remaining));
    setSyncing(false);
    loadToday(); loadProducts();
  };

  const reprint = async (saleId: string) => {
    const res = await api(`/api/pos/sales?id=${saleId}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.sale) { setError("Could not load sale for reprint"); return; }
    const s = data.sale;
    setReceipt({
      receiptNo: s.receiptNo ?? "—", invoiceNumber: undefined, total: s.totalAmount,
      lines: (s.items ?? []).map((l: any) => ({ name: l.name, qty: l.qty, amount: l.allocatedNet ?? l.amount })),
      net: s.netAmount, tax: s.taxAmount, discount: s.discountAmount, rounding: s.roundingAmount,
      tenders: s.tenders ?? [{ method: s.paymentMethod, amount: s.totalAmount }],
      change: s.changeDue ?? 0, customer: s.customerName,
    });
  };

  /* ---------- Render ---------- */

  if (shiftLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }

  if (!shift) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
          {lastClose ? (
            <>
              <p className="text-sm text-slate-400 mb-2">Shift closed</p>
              <p className="text-lg font-bold text-[#F8FAFC]">
                Variance: <span className={Math.abs(lastClose.variance ?? 0) > 0.01 ? "text-amber-400" : "text-emerald-400"}>{fmt(lastClose.variance)}</span>
              </p>
              {lastClose.flagged && <p className="text-xs text-amber-400 mt-1">Flagged — variance exceeded tolerance</p>}
              <button onClick={() => setLastClose(null)} className="text-xs text-slate-500 mt-3 underline">dismiss</button>
              <hr className="my-4 border-slate-700" />
            </>
          ) : null}
          <Clock className="w-10 h-10 text-slate-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#F8FAFC] mb-2">No open shift</h1>
          <p className="text-sm text-slate-400 mb-6">Open a shift to start selling. Sales are locked to the active shift for cash control.</p>
          {registers.length > 0 && (
            <>
              <label className="block text-left text-xs font-medium text-slate-400 mb-1">Register</label>
              <select
                value={registerId} onChange={(e) => setRegisterId(e.target.value)}
                className="w-full mb-4 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-[#F8FAFC]"
              >
                {registers.map((r) => <option key={r.id} value={r.id}>{r.code} — {r.name}</option>)}
              </select>
            </>
          )}
          <label className="block text-left text-xs font-medium text-slate-400 mb-1">Opening float (₦)</label>
          <input
            type="number" min={0} value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
            className="w-full mb-4 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-[#F8FAFC]"
          />
          {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
          <button
            onClick={openShiftNow} disabled={busy}
            className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Open Shift"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#F8FAFC]">Point of Sale</h1>
          <p className="text-sm text-slate-400 mt-1">
            {registers.length > 0 && (
              <select
                value={registerId} onChange={(e) => switchRegister(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-xs text-[#F8FAFC] mr-2"
              >
                {registers.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
              </select>
            )}
            Shift opened {new Date(shift.openedAt).toLocaleString()} · float {fmt(shift.openingFloat)}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {offlineQueue.length > 0 && (
            <button
              onClick={syncOffline} disabled={syncing}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50"
            >
              {syncing ? "Syncing…" : `Sync ${offlineQueue.length} offline sale(s)`}
            </button>
          )}
          {(["sell", "shift", "today"] as const).map((t) => (
            <button
              key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            >
              {t === "today" ? "Today's sales" : t}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {tab === "sell" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product grid */}
          <div className="lg:col-span-2">
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or SKU…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-[#F8FAFC]"
                />
              </div>
              <div className="relative w-56">
                <ScanBarcode className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  value={scanInput} onChange={(e) => setScanInput(e.target.value)} onKeyDown={onScanEnter}
                  placeholder="Scan / type SKU + Enter"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-[#F8FAFC]"
                />
              </div>
            </div>
            <div className="flex gap-2 mb-4 flex-wrap">
              <button onClick={() => setCategory(null)}
                className={`px-3 py-1 rounded-full text-xs ${!category ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"}`}>All</button>
              {categories.map((c) => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`px-3 py-1 rounded-full text-xs capitalize ${category === c ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"}`}>{c}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {visible.map((p) => (
                <button
                  key={p.sku} onClick={() => addToCart(p)} disabled={p.quantity <= 0}
                  className="text-left bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 rounded-xl p-4 transition"
                >
                  <p className="text-sm font-medium text-[#F8FAFC] truncate">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.sku}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-emerald-400">{fmt(p.unitPrice)}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.quantity <= 0 ? "bg-red-500/20 text-red-400" : p.status === "Low Stock" ? "bg-amber-500/20 text-amber-400" : "bg-slate-700 text-slate-400"}`}>
                      {p.quantity <= 0 ? "Out" : `${p.quantity} left`}
                    </span>
                  </div>
                </button>
              ))}
              {!visible.length && (
                <p className="col-span-full text-sm text-slate-500 py-10 text-center">No products match.</p>
              )}
            </div>
          </div>

          {/* Cart */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 flex flex-col max-h-[80vh]">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-[#F8FAFC]">Cart ({cart.length})</span>
              <div className="ml-auto flex gap-1">
                {heldList.length > 0 && (
                  <button onClick={() => setHeldOpen(true)} className="p-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600" title="Resume held sale">
                    <Play className="w-3.5 h-3.5" />
                  </button>
                )}
                {cart.length > 0 && (
                  <button onClick={parkSale} className="p-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600" title="Park sale">
                    <Pause className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => setReturnOpen(true)} className="p-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600" title="Return items">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-700/50">
              {cart.map((l) => (
                <div key={l.product.sku} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-[#F8FAFC] truncate">{l.product.name}</p>
                      <p className="text-xs text-slate-500">{l.product.sku} · {l.product.quantity} in stock</p>
                    </div>
                    <button onClick={() => removeLine(l.product.sku)} className="text-slate-500 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button onClick={() => setQty(l.product.sku, -1)} className="p-1 rounded bg-slate-700 text-slate-300"><Minus className="w-3 h-3" /></button>
                    <span className="text-sm text-[#F8FAFC] w-6 text-center">{l.quantity}</span>
                    <button onClick={() => setQty(l.product.sku, 1)} className="p-1 rounded bg-slate-700 text-slate-300"><Plus className="w-3 h-3" /></button>
                    <input
                      type="number" min={0} value={l.unitPrice}
                      onChange={(e) => setLine(l.product.sku, { unitPrice: Number(e.target.value) || 0 })}
                      title={l.unitPrice !== l.product.unitPrice ? "Price override — audited" : "Unit price"}
                      className={`ml-auto w-24 px-2 py-1 rounded bg-slate-900 border text-sm text-right ${l.unitPrice !== l.product.unitPrice ? "border-amber-500 text-amber-300" : "border-slate-700 text-[#F8FAFC]"}`}
                    />
                    <input
                      type="number" min={0} max={100} value={l.discountPct || ""} placeholder="Disc%"
                      onChange={(e) => setLine(l.product.sku, { discountPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                      title="Line discount %"
                      className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-sm text-right text-[#F8FAFC]"
                    />
                  </div>
                  {l.product.tracking === "serial" && (
                    <input
                      value={l.serialNos}
                      onChange={(e) => setLine(l.product.sku, { serialNos: e.target.value })}
                      placeholder={`${l.quantity} serial no(s), comma-separated`}
                      className="mt-2 w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-[#F8FAFC]"
                    />
                  )}
                  {l.product.tracking === "batch" && (
                    <input
                      value={l.lotNo}
                      onChange={(e) => setLine(l.product.sku, { lotNo: e.target.value })}
                      placeholder="Lot / batch number"
                      className="mt-2 w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-[#F8FAFC]"
                    />
                  )}
                </div>
              ))}
              {!cart.length && <p className="text-sm text-slate-500 text-center py-10">Cart is empty</p>}
            </div>
            <div className="border-t border-slate-700 p-4 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Users className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <select
                    value={customerCode}
                    onChange={(e) => { setCustomerCode(e.target.value); setRedeemPoints(0); }}
                    className="w-full pl-9 pr-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-[#F8FAFC]"
                  >
                    <option value="">Walk-in customer</option>
                    {customers.map((c) => <option key={c.customerCode} value={c.customerCode}>{c.name} ({c.customerCode})</option>)}
                  </select>
                </div>
                {!customerCode && (
                  <input
                    value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Name (optional)"
                    className="w-32 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-[#F8FAFC]"
                  />
                )}
              </div>
              {config?.loyalty.enabled && loyalty && loyalty.points > 0 && (
                <label className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Wallet className="w-3 h-3" /> {loyalty.points} pts (≈{fmt(loyalty.redeemValue)})</span>
                  <input
                    type="number" min={0} max={loyalty.points} value={redeemPoints || ""} placeholder="Redeem pts"
                    onChange={(e) => setRedeemPoints(Math.min(loyalty.points, Math.max(0, Number(e.target.value) || 0)))}
                    className="w-24 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-right text-[#F8FAFC]"
                  />
                </label>
              )}
              <div className="flex gap-2">
                <button onClick={() => setDiscountOpen(true)} className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-slate-700 text-slate-300 hover:bg-slate-600">
                  {orderDiscount ? `Discount: ${orderDiscount.pct ? `${orderDiscount.pct}%` : fmt(orderDiscount.amount ?? 0)}` : "Order discount"}
                </button>
                {vatRate > 0 && <span className="py-1.5 px-2 rounded-lg text-xs bg-slate-700 text-slate-400">VAT {vatRate}%</span>}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{fmt(linesNet)}</span></div>
                {(orderDisc + loyaltyDisc) > 0 && (
                  <div className="flex justify-between text-amber-400"><span>Discounts</span><span>−{fmt(orderDisc + loyaltyDisc)}</span></div>
                )}
                <div className="flex justify-between text-slate-400"><span>VAT</span><span>{fmt(estTax)}</span></div>
                {Math.abs(estRounding) > 0.001 && (
                  <div className="flex justify-between text-slate-400"><span>Rounding</span><span>{fmt(estRounding)}</span></div>
                )}
                <div className="flex justify-between text-lg font-bold text-[#F8FAFC]"><span>Total</span><span>{fmt(total)}</span></div>
              </div>
              <button
                onClick={() => { setTenders([{ method: "cash", amount: total }]); setTenderOpen(true); }}
                disabled={!cart.length || busy}
                className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-40"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : `Charge ${fmt(total)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "shift" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-[#F8FAFC] mb-4">Current shift</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-400">Register</dt><dd className="text-[#F8FAFC]">{registers.find((r) => r.id === shift.registerId)?.code ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Opened by</dt><dd className="text-[#F8FAFC]">{shift.openedBy ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Opened at</dt><dd className="text-[#F8FAFC]">{new Date(shift.openedAt).toLocaleString()}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Opening float</dt><dd className="text-[#F8FAFC]">{fmt(shift.openingFloat)}</dd></div>
              {shiftSummary && (
                <>
                  <div className="flex justify-between"><dt className="text-slate-400">Sales</dt><dd className="text-[#F8FAFC]">{shiftSummary.sales} ({fmt(shiftSummary.total)})</dd></div>
                  {shiftSummary.byMethod.map((m: any) => (
                    <div key={m.method} className="flex justify-between"><dt className="text-slate-400 capitalize">· {methodLabel(m.method)}</dt><dd className="text-[#F8FAFC]">{fmt(m.total)}</dd></div>
                  ))}
                  {shiftSummary.cashRefunds > 0 && (
                    <div className="flex justify-between"><dt className="text-slate-400">Cash refunds</dt><dd className="text-red-400">−{fmt(shiftSummary.cashRefunds)}</dd></div>
                  )}
                  {shiftSummary.cashMovements && (shiftSummary.cashMovements.payIn + shiftSummary.cashMovements.payOut + shiftSummary.cashMovements.drop) > 0 && (
                    <div className="flex justify-between"><dt className="text-slate-400">Cash in / out / drop</dt><dd className="text-[#F8FAFC]">
                      {fmt(shiftSummary.cashMovements.payIn)} / −{fmt(shiftSummary.cashMovements.payOut)} / −{fmt(shiftSummary.cashMovements.drop)}
                    </dd></div>
                  )}
                  {/* Blind count: expected cash stays hidden unless a manager reveals it */}
                  <div className="flex justify-between border-t border-slate-700 pt-2 mt-2">
                    <dt className="text-slate-400">Expected cash in drawer</dt>
                    <dd className="text-emerald-400 font-semibold">
                      {revealExpected ? fmt(shiftSummary.expectedCash) : (
                        <button onClick={() => setRevealExpected(true)} className="text-xs underline text-slate-500">Reveal (manager)</button>
                      )}
                    </dd>
                  </div>
                </>
              )}
            </dl>
            <div className="mt-4 flex gap-2">
              {(["pay_in", "pay_out", "drop"] as const).map((t) => (
                <button key={t} onClick={() => setCashMove({ type: t, amount: "", reason: "" })}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 capitalize">
                  {t.replace("_", " ")}
                </button>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-slate-700">
              <label className="block text-xs font-medium text-slate-400 mb-1">Counted cash in drawer (₦)</label>
              <input
                type="number" min={0} value={closingCounted}
                onChange={(e) => setClosingCounted(e.target.value)}
                className="w-full mb-3 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-[#F8FAFC]"
              />
              <input
                value={varianceReason} onChange={(e) => setVarianceReason(e.target.value)}
                placeholder="Variance reason (required if over tolerance)"
                className="w-full mb-3 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-[#F8FAFC]"
              />
              <button
                onClick={closeShiftNow} disabled={busy || closingCounted === ""}
                className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium disabled:opacity-40"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Close shift & reconcile"}
              </button>
            </div>
          </div>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-[#F8FAFC] mb-4">Shift history</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                  <th className="pb-2">Opened</th><th className="pb-2">Register</th><th className="pb-2">Float</th><th className="pb-2">Counted</th><th className="pb-2">Variance</th><th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {shiftHistory.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 text-slate-300">{new Date(s.openedAt).toLocaleDateString()}</td>
                    <td className="py-2 text-slate-300">{registers.find((r) => r.id === s.registerId)?.code ?? "—"}</td>
                    <td className="py-2 text-slate-300">{fmt(s.openingFloat)}</td>
                    <td className="py-2 text-slate-300">{s.closingCounted != null ? fmt(s.closingCounted) : "—"}</td>
                    <td className={`py-2 ${s.variance != null && Math.abs(s.variance) > 0.01 ? "text-amber-400" : "text-slate-300"}`}>
                      {s.variance != null ? fmt(s.variance) : "—"}{s.flagged ? " ⚑" : ""}
                    </td>
                    <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${s.status === "open" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>{s.status}</span></td>
                  </tr>
                ))}
                {!shiftHistory.length && <tr><td colSpan={6} className="py-8 text-center text-slate-500">No shifts yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "today" && (
        <div className="space-y-6">
          {today && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                <p className="text-xs text-slate-400">Total sales</p>
                <p className="text-xl font-bold text-[#F8FAFC] mt-1">{fmt(today.total)}</p>
              </div>
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                <p className="text-xs text-slate-400">Transactions</p>
                <p className="text-xl font-bold text-[#F8FAFC] mt-1">{today.sales}</p>
              </div>
              {today.discounts > 0 && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                  <p className="text-xs text-slate-400">Discounts</p>
                  <p className="text-lg font-semibold text-amber-400 mt-1">{fmt(today.discounts)}</p>
                </div>
              )}
              {today.cardFees > 0 && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                  <p className="text-xs text-slate-400">Card fees</p>
                  <p className="text-lg font-semibold text-red-400 mt-1">{fmt(today.cardFees)}</p>
                </div>
              )}
              {today.byMethod?.map((m: any) => (
                <div key={m.paymentMethod} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                  <p className="text-xs text-slate-400 capitalize">{methodLabel(m.paymentMethod)}</p>
                  <p className="text-lg font-semibold text-emerald-400 mt-1">{fmt(m.total)}</p>
                  <p className="text-xs text-slate-500">{m.sales} tender(s)</p>
                </div>
              ))}
            </div>
          )}
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                  <th className="px-4 py-3">Time</th><th className="px-4 py-3">Receipt</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Items</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {recent.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 text-slate-300">{new Date(s.createdAt).toLocaleTimeString()}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{s.receiptNo ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-300">{s.customerName ?? "Walk-in"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : s.status === "pending" ? "bg-amber-500/20 text-amber-400" : "bg-slate-700 text-slate-400"}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{Array.isArray(s.items) ? s.items.length : "—"}</td>
                    <td className="px-4 py-3 text-right text-[#F8FAFC]">{fmt(s.totalAmount)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => reprint(s.id)} className="text-slate-400 hover:text-emerald-400" title="Reprint receipt">
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!recent.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No sales today</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tender modal */}
      {tenderOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setTenderOpen(false)}>
          <div className="bg-slate-800 rounded-xl w-full max-w-md p-6 border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[#F8FAFC] mb-4">Take payment — {fmt(total)}</h3>
            <div className="space-y-3">
              {tenders.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={t.method}
                    onChange={(e) => setTenders(tenders.map((x, j) => j === i ? { ...x, method: e.target.value } : x))}
                    className="w-32 px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-[#F8FAFC]"
                  >
                    {METHODS.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}
                  </select>
                  <input
                    type="number" min={0} value={t.amount || ""} placeholder="Applied"
                    onChange={(e) => setTenders(tenders.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) || 0 } : x))}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-right text-[#F8FAFC]"
                  />
                  {t.method === "cash" && (
                    <input
                      type="number" min={0} value={t.tendered ?? ""} placeholder="Tendered"
                      onChange={(e) => setTenders(tenders.map((x, j) => j === i ? { ...x, tendered: Number(e.target.value) || undefined } : x))}
                      className="w-28 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-right text-[#F8FAFC]"
                    />
                  )}
                  {tenders.length > 1 && (
                    <button onClick={() => setTenders(tenders.filter((_, j) => j !== i))} className="text-slate-500 hover:text-red-400"><X className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setTenders([...tenders, { method: "pos", amount: Math.max(0, total - tenders.reduce((s, t) => s + t.amount, 0)) }])}
                className="text-xs text-emerald-400 hover:underline"
              >
                + Split tender
              </button>
              <div className="pt-3 border-t border-slate-700 space-y-1 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Applied</span>
                  <span className={Math.abs(tenders.reduce((s, t) => s + t.amount, 0) - total) > 0.01 ? "text-amber-400" : "text-emerald-400"}>
                    {fmt(tenders.reduce((s, t) => s + t.amount, 0))} / {fmt(total)}
                  </span>
                </div>
                {tenders.some((t) => t.method === "cash" && (t.tendered ?? 0) > t.amount) && (
                  <div className="flex justify-between text-emerald-400 font-semibold">
                    <span>Change due</span>
                    <span>{fmt(tenders.filter((t) => t.method === "cash").reduce((s, t) => s + ((t.tendered ?? t.amount) - t.amount), 0))}</span>
                  </div>
                )}
                {(config?.cardFeePct ?? 0) > 0 && tenders.some((t) => t.method === "pos") && (
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Card fee est. ({config!.cardFeePct}%)</span>
                    <span>{fmt(tenders.filter((t) => t.method === "pos").reduce((s, t) => s + t.amount * config!.cardFeePct / 100, 0))}</span>
                  </div>
                )}
              </div>
              <button
                onClick={checkout}
                disabled={busy || Math.abs(tenders.reduce((s, t) => s + t.amount, 0) - total) > 0.01}
                className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-40"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Complete sale"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order discount modal */}
      {discountOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setDiscountOpen(false)}>
          <div className="bg-slate-800 rounded-xl w-full max-w-sm p-6 border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[#F8FAFC] mb-4">Order discount</h3>
            <DiscountForm
              initial={orderDiscount}
              onSave={(d) => { setOrderDiscount(d); setDiscountOpen(false); }}
              onCancel={() => setDiscountOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Held sales modal */}
      {heldOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setHeldOpen(false)}>
          <div className="bg-slate-800 rounded-xl w-full max-w-md p-6 border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[#F8FAFC] mb-4">Held sales</h3>
            <div className="space-y-2">
              {heldList.map((h) => (
                <div key={h.id} className="flex items-center justify-between bg-slate-900 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm text-[#F8FAFC]">{h.label ?? "Held sale"}</p>
                    <p className="text-xs text-slate-500">{Array.isArray(h.cart) ? h.cart.length : 0} item(s) · {new Date(h.createdAt).toLocaleTimeString()}</p>
                  </div>
                  <button onClick={() => resumeSale(h)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium">Resume</button>
                </div>
              ))}
              {!heldList.length && <p className="text-sm text-slate-500 text-center py-6">No held sales</p>}
            </div>
          </div>
        </div>
      )}

      {/* Cash movement modal */}
      {cashMove && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setCashMove(null)}>
          <div className="bg-slate-800 rounded-xl w-full max-w-sm p-6 border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[#F8FAFC] mb-4 capitalize">{cashMove.type.replace("_", " ")}</h3>
            <input
              type="number" min={0} value={cashMove.amount}
              onChange={(e) => setCashMove({ ...cashMove, amount: e.target.value })}
              placeholder="Amount (₦)"
              className="w-full mb-3 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-[#F8FAFC]"
            />
            <input
              value={cashMove.reason}
              onChange={(e) => setCashMove({ ...cashMove, reason: e.target.value })}
              placeholder="Reason (e.g. bank drop, petty cash)"
              className="w-full mb-4 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-[#F8FAFC]"
            />
            <button
              onClick={submitCashMove} disabled={busy || !(Number(cashMove.amount) > 0)}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-40"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Record"}
            </button>
          </div>
        </div>
      )}

      {/* Return modal */}
      {returnOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => { setReturnOpen(false); setReturnSale(null); }}>
          <div className="bg-slate-800 rounded-xl w-full max-w-lg p-6 border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[#F8FAFC] mb-4">Return items</h3>
            <div className="flex gap-2 mb-4">
              <input
                value={returnReceiptNo} onChange={(e) => setReturnReceiptNo(e.target.value)}
                placeholder="Receipt number (e.g. POS-MAIN-000012)"
                className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-[#F8FAFC] font-mono"
              />
              <button onClick={lookupReturn} className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm">Find</button>
            </div>
            {returnSale && (
              <>
                <div className="space-y-2 max-h-56 overflow-y-auto mb-4">
                  {(returnSale.items ?? []).map((l: any) => (
                    <div key={l.sku} className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm text-[#F8FAFC]">{l.name}</p>
                        <p className="text-xs text-slate-500">{l.sku} · sold {l.qty}</p>
                      </div>
                      <input
                        type="number" min={0} max={l.qty} value={returnQty[l.sku] ?? ""}
                        onChange={(e) => setReturnQty({ ...returnQty, [l.sku]: Math.min(l.qty, Math.max(0, Number(e.target.value) || 0)) })}
                        placeholder="Qty"
                        className="w-20 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-sm text-right text-[#F8FAFC]"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mb-3">
                  <select value={returnMethod} onChange={(e) => setReturnMethod(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-[#F8FAFC]">
                    {METHODS.map((m) => <option key={m} value={m}>Refund via {methodLabel(m)}</option>)}
                  </select>
                  <input
                    value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Reason"
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-[#F8FAFC]"
                  />
                </div>
                <button
                  onClick={submitReturn} disabled={busy}
                  className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium disabled:opacity-40"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Process return & refund"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Receipt modal */}
      {receipt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setReceipt(null)}>
          <div className="bg-white rounded-xl w-full max-w-sm p-6 text-gray-900 print:shadow-none" onClick={(e) => e.stopPropagation()}>
            <div className="text-center border-b border-dashed border-gray-300 pb-3 mb-3">
              <p className="font-bold">Receipt</p>
              <p className="text-xs text-gray-500">{receipt.receiptNo}{receipt.invoiceNumber ? ` · ${receipt.invoiceNumber}` : ""}</p>
              <p className="text-xs text-gray-500">{new Date().toLocaleString()}</p>
              {receipt.customer && <p className="text-xs text-gray-500">{receipt.customer}</p>}
            </div>
            <div className="space-y-1 text-sm">
              {receipt.lines.map((l, i) => (
                <div key={i} className="flex justify-between">
                  <span>{l.name} × {l.qty}</span>
                  <span>{fmt(l.amount)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-dashed border-gray-300 text-sm space-y-1">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{fmt(receipt.net)}</span></div>
              {receipt.discount > 0 && <div className="flex justify-between text-gray-600"><span>Discounts</span><span>−{fmt(receipt.discount)}</span></div>}
              <div className="flex justify-between text-gray-600"><span>VAT</span><span>{fmt(receipt.tax)}</span></div>
              {Math.abs(receipt.rounding) > 0.001 && <div className="flex justify-between text-gray-600"><span>Rounding</span><span>{fmt(receipt.rounding)}</span></div>}
              <div className="flex justify-between font-bold text-base"><span>Total</span><span>{fmt(receipt.total)}</span></div>
              {receipt.tenders.map((t, i) => (
                <div key={i} className="flex justify-between text-gray-600"><span className="capitalize">{methodLabel(t.method)}</span><span>{fmt(t.tendered ?? t.amount)}</span></div>
              ))}
              {receipt.change > 0 && <div className="flex justify-between text-gray-600"><span>Change</span><span>{fmt(receipt.change)}</span></div>}
            </div>
            <div className="mt-5 flex gap-2 print:hidden">
              <button onClick={() => window.print()} className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium flex items-center justify-center gap-2">
                <Printer className="w-4 h-4" /> Print
              </button>
              <button onClick={() => setReceipt(null)} className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium">
                New sale
              </button>
            </div>
            <div className="mt-2 flex gap-2 print:hidden">
              <input
                type="email" value={eReceiptEmail} onChange={(e) => setEReceiptEmail(e.target.value)}
                placeholder="Email receipt to…"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
              />
              <button
                disabled={!eReceiptEmail || eReceiptBusy}
                onClick={async () => {
                  setEReceiptBusy(true);
                  try {
                    const res = await api("/api/pos/receipts", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ receiptNo: receipt.receiptNo, email: eReceiptEmail }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error ?? "Send failed");
                    setEReceiptEmail("");
                    setEReceiptSent(true);
                  } catch { /* surfaced via sent flag staying false */ }
                  finally { setEReceiptBusy(false); }
                }}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40">
                {eReceiptSent ? "Sent ✓" : eReceiptBusy ? "…" : "E-mail"}
              </button>
              <button
                title="Download ESC/POS payload for a thermal printer"
                onClick={async () => {
                  const res = await api(`/api/pos/receipts?receiptNo=${encodeURIComponent(receipt.receiptNo)}&format=escpos`);
                  const blob = await res.blob();
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `${receipt.receiptNo}.escpos`;
                  a.click();
                }}
                className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-white">
                .escpos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DiscountForm({
  initial, onSave, onCancel,
}: {
  initial: { amount?: number; pct?: number; reason: string } | null;
  onSave: (d: { amount?: number; pct?: number; reason: string } | null) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"pct" | "amount">(initial?.amount ? "amount" : "pct");
  const [value, setValue] = useState(String(initial?.amount ?? initial?.pct ?? ""));
  const [reason, setReason] = useState(initial?.reason ?? "");
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["pct", "amount"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${mode === m ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300"}`}>
            {m === "pct" ? "Percent %" : "Amount ₦"}
          </button>
        ))}
      </div>
      <input
        type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)}
        placeholder={mode === "pct" ? "Discount %" : "Discount amount"}
        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-[#F8FAFC]"
      />
      <input
        value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required — audited)"
        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-[#F8FAFC]"
      />
      <div className="flex gap-2">
        {initial && (
          <button onClick={() => onSave(null)} className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm">Remove</button>
        )}
        <button onClick={onCancel} className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm">Cancel</button>
        <button
          onClick={() => reason.trim() && onSave({ [mode === "pct" ? "pct" : "amount"]: Number(value) || 0, reason: reason.trim() } as any)}
          disabled={!reason.trim() || !(Number(value) > 0)}
          className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-40"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
