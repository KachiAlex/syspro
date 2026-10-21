"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Settings2 } from "lucide-react";
import { useTenantContextSafe } from "@/components/tenant-admin/tenant-context";

interface FieldDef {
  id: string;
  doctype: string;
  fieldName: string;
  label: string;
  fieldType: "text" | "number" | "date" | "boolean" | "select";
  options: string[] | null;
  required: boolean;
}

/**
 * Renders tenant-defined custom fields for a record and saves values into
 * metadata.custom_fields via /api/platform/custom-fields.
 * Drop into any detail/view surface: <CustomFieldsPanel doctype recordId tenantSlug />
 */
export function CustomFieldsPanel({
  doctype,
  recordId,
  tenantSlug: tenantSlugProp,
  readOnly = false,
  variant = "dark",
}: {
  doctype: string;
  recordId: string;
  /** Optional — falls back to the tenant context when mounted inside tenant-admin. */
  tenantSlug?: string;
  readOnly?: boolean;
  /** "dark" for tenant-admin surfaces, "light" for the white record modals. */
  variant?: "dark" | "light";
}) {
  const ctx = useTenantContextSafe();
  const tenantSlug = tenantSlugProp ?? ctx?.tenantSlug ?? "";
  const [defs, setDefs] = useState<FieldDef[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [defsRes, valsRes] = await Promise.all([
      fetch(`/api/platform/custom-fields?doctype=${encodeURIComponent(doctype)}&tenantSlug=${encodeURIComponent(tenantSlug)}`),
      fetch(`/api/platform/custom-fields?doctype=${encodeURIComponent(doctype)}&recordId=${encodeURIComponent(recordId)}&tenantSlug=${encodeURIComponent(tenantSlug)}`),
    ]);
    const defsBody = await defsRes.json().catch(() => ({}));
    const valsBody = await valsRes.json().catch(() => ({}));
    setDefs(defsBody.fields ?? []);
    setValues(valsBody.values ?? {});
    setLoading(false);
  }, [doctype, recordId, tenantSlug]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true); setError(null); setSaved(false);
    const res = await fetch(`/api/platform/custom-fields?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setValues", doctype, recordId, values }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(body.error ?? "Failed to save"); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const set = (name: string, v: any) => setValues((prev) => ({ ...prev, [name]: v }));

  if (loading) {
    return <div className="py-3 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>;
  }
  if (!defs.length) return null;

  const light = variant === "light";
  const inputCls = light
    ? "w-full px-2 py-1.5 rounded border border-gray-300 text-sm text-gray-900 bg-white"
    : "w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-sm text-[#F8FAFC]";
  const borderCls = light ? "border-gray-200" : "border-slate-700";
  const labelCls = light ? "text-gray-500" : "text-slate-400";
  const textCls = light ? "text-gray-700" : "text-slate-300";

  return (
    <div className={`border-t ${borderCls} mt-4 pt-4`}>
      <div className="flex items-center gap-2 mb-3">
        <Settings2 className={`w-4 h-4 ${labelCls}`} />
        <h4 className={`text-xs font-semibold ${labelCls} uppercase tracking-wide`}>Custom fields</h4>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {defs.map((d) => (
          <div key={d.id} className={d.fieldType === "boolean" ? "flex items-center gap-2" : ""}>
            {d.fieldType === "boolean" ? (
              <label className={`flex items-center gap-2 text-sm ${textCls}`}>
                <input
                  type="checkbox"
                  checked={!!values[d.fieldName]}
                  onChange={(e) => set(d.fieldName, e.target.checked)}
                  disabled={readOnly}
                  className="rounded"
                />
                {d.label}{d.required && <span className="text-red-400">*</span>}
              </label>
            ) : (
              <>
                <label className={`block text-xs ${labelCls} mb-1`}>
                  {d.label}{d.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                {d.fieldType === "select" ? (
                  <select
                    value={values[d.fieldName] ?? ""}
                    onChange={(e) => set(d.fieldName, e.target.value || undefined)}
                    disabled={readOnly}
                    className={inputCls}
                  >
                    <option value="">—</option>
                    {(d.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : d.fieldType === "date" ? (
                  <input
                    type="date"
                    value={values[d.fieldName] ?? ""}
                    onChange={(e) => set(d.fieldName, e.target.value || undefined)}
                    disabled={readOnly}
                    className={inputCls}
                  />
                ) : d.fieldType === "number" ? (
                  <input
                    type="number"
                    value={values[d.fieldName] ?? ""}
                    onChange={(e) => set(d.fieldName, e.target.value === "" ? undefined : Number(e.target.value))}
                    disabled={readOnly}
                    className={inputCls}
                  />
                ) : (
                  <input
                    type="text"
                    value={values[d.fieldName] ?? ""}
                    onChange={(e) => set(d.fieldName, e.target.value)}
                    disabled={readOnly}
                    className={inputCls}
                  />
                )}
              </>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save custom fields
          </button>
          {saved && <span className="text-xs text-emerald-400">Saved</span>}
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      )}
    </div>
  );
}
