"use client";

import React from "react";

export type KvRow = { key: string; value: string };

// Convert a stored object into editable rows. Non-primitive values travel
// as their JSON text inside the value field.
export function objectToRows(obj: Record<string, any>): KvRow[] {
  return Object.entries(obj || {}).map(([key, v]) => ({
    key,
    value: typeof v === "string" ? v : JSON.stringify(v),
  }));
}

// Rows back to an object. Values that look like JSON (objects, arrays,
// numbers, booleans, null) are parsed so typed values survive a round trip.
export function rowsToObject(rows: KvRow[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const { key, value } of rows) {
    const k = key.trim();
    if (!k) continue;
    const t = value.trim();
    if (/^(true|false|null|-?\d+(\.\d+)?|[\[{])/.test(t)) {
      try { out[k] = JSON.parse(t); continue; } catch { /* keep as string */ }
    }
    out[k] = value;
  }
  return out;
}

const input = "border border-theme-border rounded px-2 py-1.5 text-sm bg-theme-surface text-theme-text-primary";

export function KvEditor({
  rows,
  onChange,
  keyPlaceholder = "key",
  valuePlaceholder = "value",
  addLabel = "+ Add entry",
  hint,
}: {
  rows: KvRow[];
  onChange: (rows: KvRow[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={row.key}
            placeholder={keyPlaceholder}
            onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))}
            className={`${input} w-40`}
          />
          <input
            value={row.value}
            placeholder={valuePlaceholder}
            onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
            className={`${input} flex-1`}
          />
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
            className="text-theme-text-tertiary hover:text-red-600"
            aria-label="Remove entry"
          >×</button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => onChange([...rows, { key: "", value: "" }])} className="text-xs text-blue-700 underline">
          {addLabel}
        </button>
        {hint && <span className="text-xs text-theme-text-tertiary">{hint}</span>}
      </div>
      {!rows.length && !hint && <p className="text-xs text-theme-text-tertiary">Add keys and values as needed.</p>}
    </div>
  );
}
