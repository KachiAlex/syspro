"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Settings2, Plus, Trash2, Loader2, AlertCircle, X } from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

interface FieldDef {
  id: string; doctype: string; fieldName: string; label: string;
  fieldType: string; options: string[] | null; required: boolean; createdAt: string;
}

const DOCTYPES = [
  { value: "finance_invoices", label: "Invoices" },
  { value: "bills", label: "Bills" },
  { value: "finance_customers", label: "Customers" },
  { value: "vendors", label: "Vendors" },
  { value: "inventory_products", label: "Products" },
  { value: "sales_orders", label: "Sales Orders" },
  { value: "projects", label: "Projects" },
  { value: "admin_employees", label: "Employees" },
];

const FIELD_TYPES = ["text", "number", "date", "boolean", "select"] as const;

const EMPTY = { doctype: "finance_invoices", fieldName: "", label: "", fieldType: "text" as string, options: "", required: false };

export default function CustomFieldsPage() {
  const { tenantSlug } = useTenantContext();
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/platform/custom-fields?tenantSlug=${encodeURIComponent(tenantSlug)}`);
    const data = await res.json().catch(() => ({}));
    setFields(data.fields ?? []);
    setLoading(false);
  }, [tenantSlug]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setSaving(true); setError(null);
    const res = await fetch(`/api/platform/custom-fields?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doctype: form.doctype,
        fieldName: form.fieldName.trim(),
        label: form.label.trim(),
        fieldType: form.fieldType,
        required: form.required,
        options: form.fieldType === "select"
          ? form.options.split(",").map((o) => o.trim()).filter(Boolean)
          : undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(body.error ?? "Failed to create field"); return; }
    setShowModal(false); setForm(EMPTY); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this custom field? Existing values remain in record metadata.")) return;
    setDeleting(id);
    await fetch(`/api/platform/custom-fields?id=${encodeURIComponent(id)}&tenantSlug=${encodeURIComponent(tenantSlug)}`, { method: "DELETE" });
    setDeleting(null);
    load();
  };

  const grouped = fields.reduce<Record<string, FieldDef[]>>((acc, f) => {
    (acc[f.doctype] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F8FAFC] flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-emerald-400" /> Custom Fields
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Define extra fields per document type. They appear on the record&apos;s detail view and are stored in its metadata.
          </p>
        </div>
        <button
          onClick={() => { setForm(EMPTY); setError(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500"
        >
          <Plus className="w-4 h-4" /> New field
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : !fields.length ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-16 text-center">
          <Settings2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No custom fields defined yet.</p>
          <p className="text-xs text-slate-500 mt-1">Create one to capture extra data on invoices, products, orders and more.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([doctype, defs]) => (
            <div key={doctype} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-700">
                <h2 className="text-sm font-semibold text-[#F8FAFC]">
                  {DOCTYPES.find((d) => d.value === doctype)?.label ?? doctype}
                  <span className="ml-2 text-xs font-normal text-slate-500">{doctype}</span>
                </h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-700/50">
                    <th className="px-5 py-2">Field</th><th className="px-5 py-2">Label</th>
                    <th className="px-5 py-2">Type</th><th className="px-5 py-2">Options</th>
                    <th className="px-5 py-2">Required</th><th className="px-5 py-2 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {defs.map((f) => (
                    <tr key={f.id}>
                      <td className="px-5 py-3 font-mono text-xs text-slate-300">{f.fieldName}</td>
                      <td className="px-5 py-3 text-[#F8FAFC]">{f.label}</td>
                      <td className="px-5 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 capitalize">{f.fieldType}</span></td>
                      <td className="px-5 py-3 text-slate-400 text-xs">{f.options?.join(", ") ?? "—"}</td>
                      <td className="px-5 py-3 text-slate-400">{f.required ? "Yes" : "No"}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => remove(f.id)} disabled={deleting === f.id}
                          className="p-1.5 text-slate-500 hover:text-red-400 rounded"
                        >
                          {deleting === f.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#F8FAFC]">New custom field</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Document type</label>
                <select
                  value={form.doctype} onChange={(e) => setForm({ ...form, doctype: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-[#F8FAFC]"
                >
                  {DOCTYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Field name</label>
                  <input
                    value={form.fieldName}
                    onChange={(e) => setForm({ ...form, fieldName: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                    placeholder="snake_case"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-[#F8FAFC] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Type</label>
                  <select
                    value={form.fieldType} onChange={(e) => setForm({ ...form, fieldType: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-[#F8FAFC]"
                  >
                    {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Label</label>
                <input
                  value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="Shown on the record form"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-[#F8FAFC]"
                />
              </div>
              {form.fieldType === "select" && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Options (comma-separated)</label>
                  <input
                    value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })}
                    placeholder="Option A, Option B"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-[#F8FAFC]"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox" checked={form.required}
                  onChange={(e) => setForm({ ...form, required: e.target.checked })}
                  className="rounded"
                />
                Required field
              </label>
            </div>
            {error && (
              <p className="mt-4 flex items-center gap-2 text-sm text-red-400"><AlertCircle className="w-4 h-4" />{error}</p>
            )}
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-lg bg-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-600">
                Cancel
              </button>
              <button
                onClick={create} disabled={saving || !form.fieldName || !form.label}
                className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-40"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Create field"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
