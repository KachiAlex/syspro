"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, Clock, Loader2, Plus, X } from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

type Shift = {
  id: string; name: string; startTime: string; endTime: string;
  daysOfWeek: number[]; graceMinutes: number; isActive: boolean;
  assignedCount?: number;
};
type Assignment = {
  id: string; employeeId: string; employeeName: string;
  shiftId: string; shiftName: string; startTime: string; endTime: string;
  effectiveFrom: string; effectiveTo: string | null;
};
type Employee = { id: string; name: string };

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function RosterPage() {
  const { tenantSlug } = useTenantContext();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rosterDate, setRosterDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewShift, setShowNewShift] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [shiftForm, setShiftForm] = useState({ name: "", startTime: "09:00", endTime: "17:00", daysOfWeek: [1, 2, 3, 4, 5] as number[] });
  const [assignForm, setAssignForm] = useState({ employeeId: "", shiftId: "", effectiveFrom: rosterDate, effectiveTo: "" });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!tenantSlug) return;
    setLoading(true); setError(null);
    try {
      const [s, a, e] = await Promise.all([
        fetch(`/api/tenant/shifts?tenantSlug=${tenantSlug}`).then((r) => r.json()),
        fetch(`/api/tenant/shifts/assignments?tenantSlug=${tenantSlug}&date=${rosterDate}`).then((r) => r.json()),
        fetch(`/api/hr/employees?tenantSlug=${tenantSlug}&limit=500`).then((r) => r.json()),
      ]);
      if (s.error) throw new Error(s.error);
      setShifts(s.data ?? []);
      setAssignments(a.data ?? []);
      const emps = e.employees ?? e.data ?? [];
      setEmployees(emps.map((x: any) => ({ id: x.id, name: x.name ?? x.employee_name })));
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, rosterDate]);

  const createShift = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/tenant/shifts?tenantSlug=${tenantSlug}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shiftForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create shift");
      setShowNewShift(false); setShiftForm({ ...shiftForm, name: "" });
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const createAssignment = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/tenant/shifts/assignments?tenantSlug=${tenantSlug}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: assignForm.employeeId, shiftId: assignForm.shiftId,
          effectiveFrom: assignForm.effectiveFrom,
          effectiveTo: assignForm.effectiveTo || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to assign");
      setShowAssign(false);
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-sky-400" />
          <div>
            <h1 className="text-xl font-semibold">Shift Roster</h1>
            <p className="text-sm text-theme-text-secondary">Shift definitions and employee assignments</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={rosterDate} onChange={(e) => setRosterDate(e.target.value)}
            className="rounded bg-theme-muted px-3 py-1.5 text-sm" />
          <button onClick={() => setShowAssign(true)}
            className="flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1.5 text-sm hover:bg-sky-500">
            <Plus className="h-4 w-4" /> Assign
          </button>
          <button onClick={() => setShowNewShift(true)}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-sm hover:bg-emerald-500">
            <Plus className="h-4 w-4" /> New shift
          </button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {loading && <Loader2 className="h-5 w-5 animate-spin text-theme-text-secondary" />}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-theme-border bg-theme-surface/60">
          <div className="border-b border-theme-border px-4 py-3 font-semibold">Shift definitions</div>
          <table className="w-full text-sm">
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id} className="border-t border-theme-border">
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-4 py-2">{s.startTime}–{s.endTime}</td>
                  <td className="px-4 py-2 text-theme-text-secondary">{s.daysOfWeek.map((d) => DOW[d]).join(", ")}</td>
                  <td className="px-4 py-2 text-right text-theme-text-secondary">{s.assignedCount ?? 0} staff</td>
                </tr>
              ))}
              {shifts.length === 0 && <tr><td className="px-4 py-6 text-center text-theme-text-tertiary">No shifts defined</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-theme-border bg-theme-surface/60">
          <div className="border-b border-theme-border px-4 py-3 font-semibold">Roster — {rosterDate}</div>
          <table className="w-full text-sm">
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-t border-theme-border">
                  <td className="px-4 py-2">{a.employeeName ?? a.employeeId}</td>
                  <td className="px-4 py-2">{a.shiftName}</td>
                  <td className="px-4 py-2 text-theme-text-secondary">{a.startTime}–{a.endTime}</td>
                  <td className="px-4 py-2 text-right text-theme-text-secondary text-xs">
                    {a.effectiveFrom}{a.effectiveTo ? ` → ${a.effectiveTo}` : " →"}
                  </td>
                </tr>
              ))}
              {assignments.length === 0 && <tr><td className="px-4 py-6 text-center text-theme-text-tertiary">Nobody rostered on this date</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showNewShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay">
          <div className="w-full max-w-sm rounded-lg border border-theme-border bg-theme-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">New shift</h2>
              <button onClick={() => setShowNewShift(false)}><X className="h-4 w-4" /></button>
            </div>
            <input className="w-full rounded bg-theme-muted px-3 py-2 text-sm" placeholder="Shift name (e.g. Morning)"
              value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-theme-text-secondary">Start
                <input type="time" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                  value={shiftForm.startTime} onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })} />
              </label>
              <label className="text-xs text-theme-text-secondary">End
                <input type="time" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                  value={shiftForm.endTime} onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })} />
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DOW.map((d, i) => (
                <button key={d}
                  onClick={() => setShiftForm({
                    ...shiftForm,
                    daysOfWeek: shiftForm.daysOfWeek.includes(i)
                      ? shiftForm.daysOfWeek.filter((x) => x !== i)
                      : [...shiftForm.daysOfWeek, i].sort(),
                  })}
                  className={`rounded px-2.5 py-1 text-xs ${
                    shiftForm.daysOfWeek.includes(i) ? "bg-sky-600" : "bg-theme-muted"}`}>
                  {d}
                </button>
              ))}
            </div>
            <button onClick={createShift} disabled={busy || !shiftForm.name || !shiftForm.daysOfWeek.length}
              className="w-full rounded bg-emerald-600 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50">
              {busy ? "Saving…" : "Create shift"}
            </button>
          </div>
        </div>
      )}

      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay">
          <div className="w-full max-w-sm rounded-lg border border-theme-border bg-theme-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Assign shift</h2>
              <button onClick={() => setShowAssign(false)}><X className="h-4 w-4" /></button>
            </div>
            <label className="block text-xs text-theme-text-secondary">Employee
              <select className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                value={assignForm.employeeId} onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })}>
                <option value="">Select…</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
            <label className="block text-xs text-theme-text-secondary">Shift
              <select className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                value={assignForm.shiftId} onChange={(e) => setAssignForm({ ...assignForm, shiftId: e.target.value })}>
                <option value="">Select…</option>
                {shifts.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-theme-text-secondary">From
                <input type="date" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                  value={assignForm.effectiveFrom} onChange={(e) => setAssignForm({ ...assignForm, effectiveFrom: e.target.value })} />
              </label>
              <label className="text-xs text-theme-text-secondary">To (optional)
                <input type="date" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                  value={assignForm.effectiveTo} onChange={(e) => setAssignForm({ ...assignForm, effectiveTo: e.target.value })} />
              </label>
            </div>
            <button onClick={createAssignment} disabled={busy || !assignForm.employeeId || !assignForm.shiftId}
              className="w-full rounded bg-sky-600 py-2 text-sm hover:bg-sky-500 disabled:opacity-50">
              {busy ? "Assigning…" : "Assign"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
