"use client";

import React, { useState, useEffect } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendor: string;
  status: string;
  total: number;
  orderDate: string;
}

export default function PurchasesPage() {
  const { tenantSlug } = useTenantContext();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;
    async function load() {
      try {
        const res = await fetch(`/api/purchases/orders?tenantSlug=${encodeURIComponent(tenantSlug)}`);
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
        } else {
          throw new Error("Failed to fetch purchase orders");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load purchases");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantSlug]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Purchases</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && orders.length === 0 && <p>No purchase orders found.</p>}
      {!loading && orders.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">PO Number</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Vendor</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Total</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-sm text-gray-900">{order.poNumber}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{order.vendor}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{order.status}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right">${order.total.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{new Date(order.orderDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
