"use client";

import React from "react";

export default function VendorDrawer({ vendor, onClose }: { vendor: any | null; onClose: () => void }) {
  if (!vendor) return null;

  return (
    <aside className="fixed right-6 top-24 w-96 bg-white shadow-lg rounded p-4">
      <div className="flex justify-between items-start">
        <h4 className="text-lg font-semibold">Vendor</h4>
        <button onClick={onClose} className="text-slate-500">✕</button>
      </div>
      <div className="mt-3">
        <div className="text-sm text-slate-700">{vendor.name}</div>
        <div className="text-sm text-slate-500">{vendor.email}</div>
        <div className="mt-3 text-sm text-slate-600">Code: {vendor.code}</div>
      </div>
    </aside>
  );
}
