"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, CalendarOff, CheckCircle, Loader2, XCircle } from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

type LeaveRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days?: number;
  reason: string;
  status: string;
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-400",
  rejected: "bg-rose-500/15 text-rose-400",
  cancelled: "bg-theme-muted/15 text-theme-text-secondary",
};

export default function LeaveAdminPage() {
  const { tenantSlug } = useTenantContext();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState<string>("pending");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [balance, setBalance] = useState<{ employeeId: string; data: any } | null>(null);

  const load = async () => {
    if (!tenantSlug) return;
    setLoading(true); setError(null);
    try {
      const qs = `?tenantSlug=${tenantSlug}${filter ? `&status=${filter}` : ""}&limit=100`;
      const res = await fetch(`/api/hr/leave${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.formErrors?.[0] ?? data.error ?? "Failed to load");
      setRequests(data.requests ?? []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, filter]);

  const decide = async (r: LeaveRequest, status: "approved" | "rejected") => {
    setBusy(r.id); setError(null);
    try {
      const res = await fetch(`/api/hr/leave/${r.id}?tenantSlug=${tenantSlug}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  const showBalance = async (r: LeaveRequest) => {
    try {
      const res = await fetch(`/api/hr/leave?tenantSlug=${tenantSlug}&employeeId=${r.employeeId}`);
      const data = await res.json();
      setBalance({ employeeId: r.employeeId, data });
    } catch { /* balance view is best-effort */ }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarOff className="h-6 w-6 text-sky-400" />
          <div>
            <h1 className="text-xl font-semibold">Leave Management</h1>
            <p className="text-sm text-theme-text-secondary">Review, approve, and track employee leave</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {["pending", "approved", "rejected", "cancelled"].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`rounded px-3 py-1.5 text-xs capitalize ${
                filter === s ? "bg-sky-600" : "bg-theme-muted hover:bg-theme-elevated"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {loading && <Loader2 className="h-5 w-5 animate-spin text-theme-text-secondary" />}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-theme-text-secondary">
            {["Employee", "Type", "Dates", "Days", "Reason", "Status", "Actions"].map((h) => (
              <th key={h} className="px-3 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => {
            const days = r.days ?? Math.max(1, Math.round(
              (new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86400000) + 1);
            return (
              <tr key={r.id} className="border-t border-theme-border">
                <td className="px-3 py-2">{r.employeeName}
                  <button onClick={() => showBalance(r)} className="ml-2 text-xs text-sky-400 hover:underline">
                    balance
                  </button>
                </td>
                <td className="px-3 py-2 capitalize">{r.leaveType}</td>
                <td className="px-3 py-2">{String(r.startDate).slice(0, 10)} → {String(r.endDate).slice(0, 10)}</td>
                <td className="px-3 py-2">{days}</td>
                <td className="px-3 py-2 text-theme-text-secondary max-w-[200px] truncate" title={r.reason}>{r.reason}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[r.status] ?? ""}`}>{r.status}</span>
                </td>
                <td className="px-3 py-2">
                  {r.status === "pending" && (
                    <div className="flex gap-1.5">
                      <button onClick={() => decide(r, "approved")} disabled={busy === r.id}
                        className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs hover:bg-emerald-500 disabled:opacity-50">
                        <CheckCircle className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button onClick={() => decide(r, "rejected")} disabled={busy === r.id}
                        className="flex items-center gap-1 rounded bg-rose-600 px-2 py-1 text-xs hover:bg-rose-500 disabled:opacity-50">
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {requests.length === 0 && !loading && (
            <tr><td colSpan={7} className="px-3 py-6 text-center text-theme-text-tertiary">No {filter} requests</td></tr>
          )}
        </tbody>
      </table>

      {balance && (
        <div className="rounded-lg border border-theme-border bg-theme-surface/60 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="font-semibold">Leave balance</span>
            <button onClick={() => setBalance(null)} className="text-theme-text-secondary hover:text-theme-text-primary">✕</button>
          </div>
          <pre className="mt-2 overflow-x-auto text-xs text-theme-text-primary">{JSON.stringify(balance.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
