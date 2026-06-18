"use client";

import React, { useState, useEffect } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

interface Supplier {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  status: string;
}

export default function SuppliersPage() {
  const { tenantSlug } = useTenantContext();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;
    async function load() {
      try {
        const res = await fetch(`/api/suppliers?tenantSlug=${encodeURIComponent(tenantSlug)}`);
        if (res.ok) {
          const data = await res.json();
          setSuppliers(data.suppliers || []);
        } else {
          throw new Error("Failed to fetch suppliers");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load suppliers");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantSlug]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Suppliers</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && suppliers.length === 0 && <p>No suppliers found.</p>}
      {!loading && suppliers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Name</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Contact</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Email</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Phone</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-sm text-gray-900">{supplier.name}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{supplier.contact}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{supplier.email}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{supplier.phone}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{supplier.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
