"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import VendorDrawer from "./vendor-drawer";

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
}

export default function VendorsWorkspace() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selected, setSelected] = useState<Vendor | null>(null);
  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    loadVendors();
  }, []);

  useEffect(() => {
    if (selected) {
      loadVendorProfile(selected.id);
    } else {
      setVendorProfile(null);
    }
  }, [selected]);

  const loadVendors = async () => {
    try {
      const response = await fetch("/api/finance/vendors?tenantSlug=demo-tenant");
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
      const vendorResponse = await fetch("/api/finance/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId })
      });
      const vendorData = await vendorResponse.json();

      // Load vendor bills
      const billsResponse = await fetch(`/api/finance/bills?tenantSlug=demo-tenant&vendorId=${vendorId}`);
      const billsData = await billsResponse.json();

      // Load vendor payments
      const paymentsResponse = await fetch(`/api/finance/vendor-payments?tenantSlug=demo-tenant&vendorId=${vendorId}`);
      const paymentsData = await paymentsResponse.json();

      const vendor = vendorData.vendor;
      const bills = billsData.bills || [];
      const payments = paymentsData.payments || [];

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
        contacts: [], // TODO: Load from vendor contacts API
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
        <button className="btn btn-primary">New Vendor</button>
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
                    <button className="btn btn-outline btn-sm">Edit</button>
                    <button className="btn btn-primary btn-sm">Create PO</button>
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-4 p-6 border-b">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-900">
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
                  <div className="text-center py-8 text-gray-500">
                    Purchase Orders tab - Coming soon
                  </div>
                )}
                {activeTab === "accounting" && (
                  <div className="text-center py-8 text-gray-500">
                    Accounting tab - Coming soon
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
        <div className="grid grid-cols-2 gap-4 text-sm">
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
                      "bg-gray-100 text-gray-800"
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
