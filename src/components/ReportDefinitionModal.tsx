"use client";

import React from "react";

export default function ReportDefinitionModal({ open, onClose, definition }: { open: boolean; onClose: () => void; definition: any }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-xl bg-white p-6">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold">Report definition</h3>
          <button onClick={onClose} className="text-sm text-slate-500">Close</button>
        </div>
        <div className="mt-4 max-h-[60vh] overflow-auto text-xs font-mono whitespace-pre-wrap break-all p-2 bg-slate-50 rounded">
          {typeof definition === "string" ? definition : JSON.stringify(definition, null, 2)}
        </div>
      </div>
    </div>
  );
}
