"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { ArrowRight, RefreshCw, CheckCircle2 } from "lucide-react";

type PartyType = "customer" | "supplier";

interface OpenDocument {
  id: string;
  number: string;
  date: string;
  partyId: string;
  party: string;
  total: number;
  balanceDue: number;
  currency?: string;
}

interface UnallocatedPayment {
  id: string;
  reference: string;
  date: string;
  partyId: string | null;
  party: string | null;
  amount: number;
  unallocated: number;
  method?: string;
  currency?: string;
}

interface Party {
  id: string;
  name: string;
}

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PaymentReconciliationPage() {
  const { tenantSlug } = useTenantContext();
  const [partyType, setPartyType] = useState<PartyType>("customer");
  const [partyId, setPartyId] = useState("");
  const [parties, setParties] = useState<Party[]>([]);
  const [documents, setDocuments] = useState<OpenDocument[]>([]);
  const [payments, setPayments] = useState<UnallocatedPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<UnallocatedPayment | null>(null);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Load party list for the filter dropdown
  useEffect(() => {
    if (!tenantSlug) return;
    const url = partyType === "customer"
      ? `/api/finance/customers?tenantSlug=${encodeURIComponent(tenantSlug)}`
      : `/api/finance/vendors?tenantSlug=${encodeURIComponent(tenantSlug)}`;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        const list = j.customers ?? j.vendors ?? j.data ?? [];
        setParties(
          (Array.isArray(list) ? list : []).map((p: any) => ({
            id: p.id ?? p.vendor_id ?? p.customer_id ?? p.customer_code ?? p.vendor_code,
            name: p.name ?? p.display_name ?? p.legal_name ?? p.customer_name ?? p.vendor_code ?? "Unknown",
          })),
        );
      })
      .catch(() => setParties([]));
  }, [tenantSlug, partyType]);

  const load = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const p = new URLSearchParams({ tenantSlug, partyType });
      if (partyId) p.set("partyId", partyId);
      const res = await fetch(`/api/finance/payment-reconciliation?${p}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Load failed");
      setDocuments(json.data.documents);
      setPayments(json.data.payments);
    } catch (err: any) {
      setAlert({ type: "error", message: err?.message ?? "Failed to load" });
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, partyType, partyId]);

  useEffect(() => { load(); }, [load]);

  const allocatedTotal = useMemo(
    () => Object.values(allocations).reduce((s, v) => s + (parseFloat(v) || 0), 0),
    [allocations],
  );

  const remaining = selectedPayment ? selectedPayment.unallocated - allocatedTotal : 0;

  const submit = async () => {
    if (!tenantSlug || !selectedPayment) return;
    const allocs = Object.entries(allocations)
      .map(([documentId, amt]) => ({ paymentId: selectedPayment.id, documentId, amount: parseFloat(amt) }))
      .filter((a) => a.amount > 0);
    if (!allocs.length) {
      setAlert({ type: "error", message: "Enter at least one allocation amount" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/finance/payment-reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug, partyType, allocations: allocs }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const firstErr = json.data?.errors?.[0]?.error ?? json.error ?? "Reconciliation failed";
        throw new Error(firstErr);
      }
      setAlert({ type: "success", message: `Applied ${allocs.length} allocation${allocs.length > 1 ? "s" : ""}` });
      setSelectedPayment(null);
      setAllocations({});
      await load();
    } catch (err: any) {
      setAlert({ type: "error", message: err?.message ?? "Reconciliation failed" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {alert && (
          <div className={`p-4 rounded-lg border ${alert.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
            <div className="flex items-center justify-between">
              <span>{alert.message}</span>
              <button onClick={() => setAlert(null)} className="hover:opacity-70">×</button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-black">Payment Reconciliation</h1>
            <p className="text-black mt-1">
              Match unallocated {partyType === "customer" ? "customer payments" : "vendor payments"} against open {partyType === "customer" ? "invoices" : "bills"}
            </p>
          </div>
          <button onClick={load} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-900">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-wrap items-center gap-4">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {(["customer", "supplier"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setPartyType(t); setPartyId(""); setSelectedPayment(null); setAllocations({}); }}
                className={`px-5 py-2 text-sm font-medium ${partyType === t ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
              >
                {t === "customer" ? "Receivables" : "Payables"}
              </button>
            ))}
          </div>
          <select
            value={partyId}
            onChange={(e) => { setPartyId(e.target.value); setSelectedPayment(null); setAllocations({}); }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-56"
          >
            <option value="">All {partyType === "customer" ? "customers" : "suppliers"}</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Unallocated payments */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-black mb-4">
              Unallocated Payments <span className="text-sm font-normal text-gray-500">({payments.length})</span>
            </h2>
            {payments.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">No unallocated payments — everything is fully applied.</p>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
                {payments.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedPayment(p); setAllocations({}); }}
                    className={`w-full text-left py-3 px-3 rounded-lg transition ${selectedPayment?.id === p.id ? "bg-blue-50 ring-1 ring-blue-300" : "hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{p.reference}</p>
                        <p className="text-xs text-gray-500">{p.date} · {p.party ?? "Unassigned"} · {p.method ?? ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-amber-600">{fmt(p.unallocated)}</p>
                        <p className="text-xs text-gray-400">of {fmt(p.amount)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Open documents */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-black mb-4">
              Open {partyType === "customer" ? "Invoices" : "Bills"} <span className="text-sm font-normal text-gray-500">({documents.length})</span>
            </h2>
            {!selectedPayment ? (
              <p className="text-sm text-gray-500 py-6 text-center">Select a payment on the left to allocate it against open documents.</p>
            ) : documents.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">No open {partyType === "customer" ? "invoices" : "bills"} to reconcile.</p>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
                {documents.map((d) => (
                  <div key={d.id} className="py-3 px-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{d.number}</p>
                      <p className="text-xs text-gray-500">{d.date} · {d.party} · due {fmt(d.balanceDue)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={allocations[d.id] ?? ""}
                        onChange={(e) => setAllocations((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        className="w-28 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => setAllocations((prev) => ({ ...prev, [d.id]: Math.min(d.balanceDue, remaining + (parseFloat(prev[d.id]) || 0)).toFixed(2) }))}
                        className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                      >
                        Full
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Allocation bar */}
        {selectedPayment && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-4 sticky bottom-4">
            <div className="text-sm text-gray-700">
              <span className="font-medium">{selectedPayment.reference}</span>
              <ArrowRight className="inline h-4 w-4 mx-2 text-gray-400" />
              allocating <span className="font-semibold">{fmt(allocatedTotal)}</span> of{" "}
              <span className="font-semibold">{fmt(selectedPayment.unallocated)}</span>
              <span className={`ml-3 ${remaining < -0.009 ? "text-red-600 font-medium" : "text-gray-500"}`}>
                ({fmt(remaining)} remaining)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setSelectedPayment(null); setAllocations({}); }}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting || allocatedTotal <= 0 || remaining < -0.009}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {submitting ? "Reconciling…" : "Reconcile"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
