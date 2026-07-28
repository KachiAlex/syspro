"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import VendorDrawer from "./vendor-drawer";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

interface Vendor {
  id: string;
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  paymentTerms?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface VendorProfile {
  vendor: Vendor;
  stats: {
    totalSpend: number;
    outstandingBalance: number;
    lastPaymentDate?: string;
    billCount: number;
    paymentCount: number;
  };
  contacts: Array<{
    id: string;
    name: string;
    role?: string;
    email?: string;
    phone?: string;
    isPrimary?: boolean;
  }>;
  bills: Array<{
    id: string;
    billNumber: string;
    billDate: string;
    dueDate?: string;
    total: number;
    balanceDue: number;
    status: string;
  }>;
  payments: Array<{
    id: string;
    paymentNumber: string;
    paymentDate: string;
    amount: number;
    appliedAmount: number;
    status: string;
  }>;
  purchaseOrders: Array<{
    id: string;
    poNumber: string;
    poDate: string;
    dueDate?: string;
    total: number;
    status: string;
  }>;
}

export default function VendorsWorkspace() {
  const { tenantSlug } = useTenantContext();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selected, setSelected] = useState<Vendor | null>(null);
  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Vendor>>({});

  useEffect(() => {
    if (tenantSlug) loadVendors();
  }, [tenantSlug]);

  useEffect(() => {
    if (selected) {
      loadVendorProfile(selected.id);
    } else {
      setVendorProfile(null);
    }
  }, [selected]);

  const loadVendors = async () => {
    try {
      const response = await fetch(`/api/finance/vendors?tenantSlug=${encodeURIComponent(tenantSlug)}`);
      const data = await response.json();
      setVendors(data.vendors || []);
    } catch (error) {
      console.error("Failed to load vendors:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadVendorProfile = async (vendorId: string) => {
    try {
      // Load vendor details
      const vendorResponse = await fetch(`/api/finance/vendors/${encodeURIComponent(vendorId)}`);
      const vendorData = await vendorResponse.json();

      // Load vendor bills
      const billsResponse = await fetch(`/api/finance/bills?tenantSlug=${encodeURIComponent(tenantSlug)}&vendorId=${vendorId}`);
      const billsData = await billsResponse.json();

      // Load vendor payments
      const paymentsResponse = await fetch(`/api/finance/vendor-payments?tenantSlug=${encodeURIComponent(tenantSlug)}&vendorId=${vendorId}`);
      const paymentsData = await paymentsResponse.json();

      // Load vendor contacts
      const contactsResponse = await fetch(`/api/finance/vendors/${encodeURIComponent(vendorId)}/contacts?tenantSlug=${encodeURIComponent(tenantSlug)}`);
      const contactsData = await contactsResponse.json().catch(() => ({}));

      // Load vendor purchase orders
      const poResponse = await fetch(`/api/purchases/orders?tenantSlug=${encodeURIComponent(tenantSlug)}&vendorId=${vendorId}`);
      const poData = await poResponse.json().catch(() => ({}));

      const vendor = vendorData.vendor;
      const bills = billsData.bills || [];
      const payments = paymentsData.payments || [];
      const contacts = contactsData.contacts || [];
      const pos = poData.orders || [];

      // Calculate stats
      const totalSpend = bills.reduce((sum: number, bill: any) => sum + bill.total, 0);
      const outstandingBalance = bills.reduce((sum: number, bill: any) => sum + bill.balanceDue, 0);
      const lastPaymentDate = payments.length > 0 ? 
        payments.sort((a: any, b: any) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0].paymentDate : 
        undefined;

      setVendorProfile({
        vendor,
        stats: {
          totalSpend,
          outstandingBalance,
          lastPaymentDate,
          billCount: bills.length,
          paymentCount: payments.length
        },
        contacts,
        bills: bills.map((bill: any) => ({
          id: bill.id,
          billNumber: bill.billNumber,
          billDate: bill.billDate,
          dueDate: bill.dueDate,
          total: bill.total,
          balanceDue: bill.balanceDue,
          status: bill.status
        })),
        payments: payments.map((payment: any) => ({
          id: payment.id,
          paymentNumber: payment.paymentNumber,
          paymentDate: payment.paymentDate,
          amount: payment.amount,
          appliedAmount: payment.appliedAmount,
          status: payment.status
        })),
        purchaseOrders: pos.map((po: any) => ({
          id: po.id,
          poNumber: po.poNumber || po.number || "PO-" + po.id.slice(0, 6),
          poDate: po.poDate || po.orderDate || po.createdAt,
          dueDate: po.dueDate || po.expectedDeliveryDate,
          total: po.total || po.amount || 0,
          status: po.status || "Pending",
        }))
      });
    } catch (error) {
      console.error("Failed to load vendor profile:", error);
    }
  };

  if (loading) {
    return <div className="p-6">Loading vendors...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Vendors & Procurement</h1>
        <button
          onClick={async () => {
            const name = prompt("New vendor name:");
            if (!name) return;
            try {
              setLoading(true);
              const res = await fetch(`/api/finance/vendors?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
              });
              if (!res.ok) throw new Error("Failed to create vendor");
              await loadVendors();
            } catch (err) {
              console.error(err);
              alert("Failed to create vendor");
            } finally {
              setLoading(false);
            }
          }}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
        >
          New Vendor
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Vendor List */}
        <div className="col-span-1">
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium">All Vendors</h2>
            </div>
            <ul className="space-y-2">
              {vendors.map((v) => (
                <li 
                  key={v.id} 
                  className={`p-2 border rounded cursor-pointer transition-colors ${
                    selected?.id === v.id ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"
                  }`}
                  onClick={() => setSelected(v)}
                >
                  <div className="font-medium">{v.name}</div>
                  <div className="text-sm text-slate-500">
                    {v.country || ""} {v.code ? `• ${v.code}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Vendor Profile */}
        <div className="col-span-3">
          {vendorProfile ? (
            <div className="bg-white shadow rounded-lg">
              {/* Profile Header */}
              <div className="border-b px-6 py-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-semibold">{vendorProfile.vendor.name}</h3>
                    <p className="text-sm text-slate-600">{vendorProfile.vendor.email}</p>
                    <div className="mt-2 flex items-center space-x-4 text-sm text-slate-500">
                      <span>Code: {vendorProfile.vendor.code}</span>
                      <span>Terms: {vendorProfile.vendor.paymentTerms}</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        vendorProfile.vendor.isActive 
                          ? "bg-green-100 text-green-800" 
                          : "bg-red-100 text-red-800"
                      }`}>
                        {vendorProfile.vendor.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setEditForm(vendorProfile.vendor);
                        setEditModalOpen(true);
                      }}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete vendor "${vendorProfile.vendor.name}"?`)) return;
                        try {
                          const res = await fetch(`/api/finance/vendors/${encodeURIComponent(vendorProfile.vendor.id)}`, {
                            method: "DELETE",
                          });
                          if (!res.ok) throw new Error("Failed to delete vendor");
                          setSelected(null);
                          setVendorProfile(null);
                          await loadVendors();
                        } catch (err) {
                          console.error(err);
                          alert("Failed to delete vendor");
                        }
                      }}
                      className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:text-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
                    >
                      Delete
                    </button>
                    <button className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400">
                      Create PO
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-4 p-6 border-b">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    ${vendorProfile.stats.totalSpend.toLocaleString()}
                  </div>
                  <div className="text-sm text-blue-600">Total Spend</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-orange-900">
                    ${vendorProfile.stats.outstandingBalance.toLocaleString()}
                  </div>
                  <div className="text-sm text-orange-600">Outstanding</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-900">
                    {vendorProfile.stats.billCount}
                  </div>
                  <div className="text-sm text-green-600">Bills</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-900">
                    {vendorProfile.stats.paymentCount}
                  </div>
                  <div className="text-sm text-purple-600">Payments</div>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b">
                <nav className="flex space-x-8 px-6">
                  {["overview", "contacts", "bills", "payments", "purchase-orders", "accounting"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm ${
                        activeTab === tab
                          ? "border-blue-500 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {tab.replace("-", " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === "overview" && (
                  <VendorOverview vendor={vendorProfile.vendor} stats={vendorProfile.stats} />
                )}
                {activeTab === "contacts" && (
                  <VendorContacts contacts={vendorProfile.contacts} />
                )}
                {activeTab === "bills" && (
                  <VendorBills bills={vendorProfile.bills} />
                )}
                {activeTab === "payments" && (
                  <VendorPayments payments={vendorProfile.payments} />
                )}
                {activeTab === "purchase-orders" && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-700 font-medium">
                        <tr>
                          <th className="px-4 py-2">PO Number</th>
                          <th className="px-4 py-2">Date</th>
                          <th className="px-4 py-2">Due</th>
                          <th className="px-4 py-2 text-right">Total</th>
                          <th className="px-4 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendorProfile.purchaseOrders.length > 0 ? vendorProfile.purchaseOrders.map((po) => (
                          <tr key={po.id} className="border-t">
                            <td className="px-4 py-2 font-medium">{po.poNumber}</td>
                            <td className="px-4 py-2">{po.poDate ? new Date(po.poDate).toLocaleDateString() : "-"}</td>
                            <td className="px-4 py-2">{po.dueDate ? new Date(po.dueDate).toLocaleDateString() : "-"}</td>
                            <td className="px-4 py-2 text-right">${po.total.toLocaleString()}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                po.status === "Received" ? "bg-green-100 text-green-800" :
                                po.status === "Pending" ? "bg-amber-100 text-amber-800" :
                                po.status === "In Transit" ? "bg-blue-100 text-blue-800" :
                                "bg-gray-100 text-gray-800"
                              }`}>{po.status}</span>
                            </td>
                          </tr>
                        )) : (
                          <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No purchase orders found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                {activeTab === "accounting" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-lg font-semibold text-gray-900">${vendorProfile.stats.totalSpend.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">Total Spend</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-lg font-semibold text-gray-900">${vendorProfile.stats.outstandingBalance.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">Outstanding</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-lg font-semibold text-gray-900">{vendorProfile.stats.paymentCount}</div>
                        <div className="text-sm text-gray-600">Payments Made</div>
                      </div>
                    </div>
                    <h4 className="font-semibold text-gray-900">Recent Bills</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-medium">
                          <tr>
                            <th className="px-4 py-2">Bill #</th>
                            <th className="px-4 py-2">Date</th>
                            <th className="px-4 py-2 text-right">Total</th>
                            <th className="px-4 py-2 text-right">Balance</th>
                            <th className="px-4 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vendorProfile.bills.slice(0, 5).map((bill) => (
                            <tr key={bill.id} className="border-t">
                              <td className="px-4 py-2 font-medium">{bill.billNumber}</td>
                              <td className="px-4 py-2">{new Date(bill.billDate).toLocaleDateString()}</td>
                              <td className="px-4 py-2 text-right">${bill.total.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right">${bill.balanceDue.toLocaleString()}</td>
                              <td className="px-4 py-2"><span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">{bill.status}</span></td>
                            </tr>
                          ))}
                          {vendorProfile.bills.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No bills found</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <div className="text-slate-500">Select a vendor to view details</div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={(e) => { if (e.target === e.currentTarget) setEditModalOpen(false); }}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Edit Vendor</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  value={editForm.name || ""}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={editForm.email || ""}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
                <input
                  type="text"
                  value={editForm.phone || ""}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
                <input
                  type="text"
                  value={editForm.address || ""}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">City</label>
                <input
                  type="text"
                  value={editForm.city || ""}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Country</label>
                <input
                  type="text"
                  value={editForm.country || ""}
                  onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Payment Terms</label>
                <input
                  type="text"
                  value={editForm.paymentTerms || ""}
                  onChange={(e) => setEditForm({ ...editForm, paymentTerms: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-black"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={editForm.isActive ?? true}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-slate-700">Active</label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditModalOpen(false)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!editForm.id) return;
                  try {
                    setLoading(true);
                    const res = await fetch(`/api/finance/vendors/${encodeURIComponent(editForm.id)}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(editForm),
                    });
                    if (!res.ok) throw new Error("Failed to update vendor");
                    setEditModalOpen(false);
                    await loadVendors();
                    if (selected?.id === editForm.id) {
                      await loadVendorProfile(editForm.id);
                    }
                  } catch (err) {
                    console.error(err);
                    alert("Failed to update vendor");
                  } finally {
                    setLoading(false);
                  }
                }}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-black hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <VendorDrawer vendor={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

// Tab Components
function VendorOverview({ vendor, stats }: { vendor: Vendor; stats: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Vendor Information</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Legal Name:</span>
            <div className="font-medium">{vendor.name}</div>
          </div>
          <div>
            <span className="text-gray-500">Vendor Code:</span>
            <div className="font-medium">{vendor.code}</div>
          </div>
          <div>
            <span className="text-gray-500">Email:</span>
            <div className="font-medium">{vendor.email}</div>
          </div>
          <div>
            <span className="text-gray-500">Phone:</span>
            <div className="font-medium">{vendor.phone}</div>
          </div>
          <div>
            <span className="text-gray-500">Address:</span>
            <div className="font-medium">{vendor.address}</div>
          </div>
          <div>
            <span className="text-gray-500">City/Country:</span>
            <div className="font-medium">{vendor.city}, {vendor.country}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VendorContacts({ contacts }: { contacts: any[] }) {
  return (
    <div>
      <h4 className="font-medium text-gray-900 mb-3">Vendor Contacts</h4>
      {contacts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No contacts found
        </div>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact) => (
            <div key={contact.id} className="border rounded p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{contact.name}</div>
                  <div className="text-sm text-gray-500">{contact.role}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {contact.email} • {contact.phone}
                  </div>
                </div>
                {contact.isPrimary && (
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                    Primary
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VendorBills({ bills }: { bills: any[] }) {
  return (
    <div>
      <h4 className="font-medium text-gray-900 mb-3">Recent Bills</h4>
      {bills.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No bills found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bill Number</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bills.map((bill) => (
                <tr key={bill.id}>
                  <td className="px-4 py-2 text-sm font-medium">{bill.billNumber}</td>
                  <td className="px-4 py-2 text-sm">{format(new Date(bill.billDate), "MMM dd, yyyy")}</td>
                  <td className="px-4 py-2 text-sm">
                    {bill.dueDate ? format(new Date(bill.dueDate), "MMM dd, yyyy") : "-"}
                  </td>
                  <td className="px-4 py-2 text-sm">${bill.total.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm">${bill.balanceDue.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      bill.status === "paid" ? "bg-green-100 text-green-800" :
                      bill.status === "overdue" ? "bg-red-100 text-red-800" :
                      "bg-blue-100 text-blue-800"
                    }`}>
                      {bill.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VendorPayments({ payments }: { payments: any[] }) {
  return (
    <div>
      <h4 className="font-medium text-gray-900 mb-3">Recent Payments</h4>
      {payments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No payments found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment Number</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Applied</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-4 py-2 text-sm font-medium">{payment.paymentNumber}</td>
                  <td className="px-4 py-2 text-sm">{format(new Date(payment.paymentDate), "MMM dd, yyyy")}</td>
                  <td className="px-4 py-2 text-sm">${payment.amount.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm">${payment.appliedAmount.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      payment.status === "reconciled" ? "bg-green-100 text-green-800" :
                      payment.status === "posted" ? "bg-blue-100 text-blue-800" :
                      "bg-gray-100 text-gray-900"
                    }`}>
                      {payment.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
