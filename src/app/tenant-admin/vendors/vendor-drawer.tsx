"use client";

import React from "react";

export default function VendorDrawer({ vendor, onClose }: { vendor: any | null; onClose: () => void }) {
  if (!vendor) return null;

  return (
    <aside className="fixed right-6 top-24 w-96 bg-theme-surface shadow-lg rounded p-4">
      <div className="flex justify-between items-start">
        <h4 className="text-lg font-semibold">Vendor</h4>
        <button onClick={onClose} className="text-theme-text-tertiary">✕</button>
      </div>
      <div className="mt-3">
        <div className="text-sm text-theme-text-primary">{vendor.name}</div>
        <div className="text-sm text-theme-text-tertiary">{vendor.email}</div>
        <div className="mt-3 text-sm text-theme-text-secondary">Code: {vendor.code}</div>
      </div>
    </aside>
  );
}
