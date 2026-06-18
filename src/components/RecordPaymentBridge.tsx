"use client";

import React, { useEffect, useState } from "react";
import { CreatePaymentModal } from "@/app/tenant-admin/payments/payments-workspace";

export default function RecordPaymentBridge() {
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest("button");
      if (!btn) return;
      const text = btn.textContent?.trim() ?? "";
      if (text.includes("Record Payment")) {
        e.preventDefault();
        setShow(true);
      }
    }

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <>
      {show && (
        <CreatePaymentModal
          onClose={() => setShow(false)}
          onSuccess={() => setShow(false)}
          onError={(err) => setError(err)}
        />
      )}
      {error && (
        <div className="fixed bottom-6 right-6 z-50 rounded-md bg-red-600 px-4 py-2 text-white">
          {error}
        </div>
      )}
    </>
  );
}
