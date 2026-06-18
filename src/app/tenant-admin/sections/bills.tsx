'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit, CreditCard, Download, Filter, FileText, Calculator, AlertCircle, Calendar } from 'lucide-react';
import { AddBillModal, MakePaymentModal, SchedulePaymentModal } from './bills-modals';

interface Bills {
  tenantSlug: string;
}

interface ApiBill {
  id: string;
  billNumber: string;
  vendorId: string;
  total: number;
  balanceDue: number;
  status: string;
  dueDate?: string;
  currency: string;
}

interface AgingBucket {
  label: string;
  amount: number;
  colorClass: string;
}

interface VendorOption {
  id: string;
  name: string;
}

const BillsComponent: React.FC<Bills> = ({ tenantSlug }) => {
  const [bills, setBills] = useState<ApiBill[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [vendorsMap, setVendorsMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [vendorFilter, setVendorFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [agingBuckets, setAgingBuckets] = useState<AgingBucket[]>([
    { label: 'Over 90 Days', amount: 0, colorClass: 'text-red-400' },
    { label: '61-90 Days', amount: 0, colorClass: 'text-orange-600' },
    { label: '31-60 Days', amount: 0, colorClass: 'text-yellow-600' },
    { label: '0-30 Days', amount: 0, colorClass: 'text-green-400' },
  ]);

  const filteredBills = bills.filter(bill => {
    if (statusFilter !== 'All' && bill.status !== statusFilter.toLowerCase().replace(' ', '_')) return false;
    if (vendorFilter !== 'All' && vendorsMap[bill.vendorId] !== vendorFilter) return false;
    if (searchQuery && !bill.billNumber.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    const symbol = currency === 'NGN' ? '₦' : '$';
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  useEffect(() => {
    if (!tenantSlug) return;
    loadBills();
    loadAging();
  }, [tenantSlug]);

  const loadBills = async () => {
    setLoading(true);
    try {
      const [billsRes, vendorsRes] = await Promise.all([
        fetch(`/api/finance/bills?tenantSlug=${encodeURIComponent(tenantSlug)}&limit=200`),
        fetch(`/api/finance/vendors?tenantSlug=${encodeURIComponent(tenantSlug)}&limit=200`).catch(() => null)
      ]);
      const billsData = await billsRes.json();
      setBills(billsData.bills || []);

      if (vendorsRes && vendorsRes.ok) {
        const vendorsData = await vendorsRes.json();
        const list: VendorOption[] = [];
        const map: Record<string, string> = {};
        (vendorsData.vendors || []).forEach((v: any) => {
          const name = v.name || v.code || v.id;
          list.push({ id: v.id, name });
          map[v.id] = name;
        });
        setVendors(list);
        setVendorsMap(map);
      }
    } catch (err) {
      console.error('Failed to load bills:', err);
      setAlert({ type: 'error', message: 'Failed to load bills' });
    } finally {
      setLoading(false);
    }
  };

  const loadAging = async () => {
    try {
      const res = await fetch(`/api/finance/bills?tenantSlug=${encodeURIComponent(tenantSlug)}&aging=true`);
      const data = await res.json();
      const aging = data.aging || [];
      const totals = { current: 0, days31: 0, days61: 0, days90: 0 };
      aging.forEach((a: any) => {
        totals.current += Number(a.current || 0);
        totals.days31 += Number(a.days31 || 0);
        totals.days61 += Number(a.days61 || 0);
        totals.days90 += Number(a.days90 || 0);
      });
      setAgingBuckets([
        { label: 'Over 90 Days', amount: totals.days90, colorClass: 'text-red-400' },
        { label: '61-90 Days', amount: totals.days61, colorClass: 'text-orange-600' },
        { label: '31-60 Days', amount: totals.days31, colorClass: 'text-yellow-600' },
        { label: '0-30 Days', amount: totals.current, colorClass: 'text-green-400' },
      ]);
    } catch (err) {
      console.error('Failed to load aging:', err);
    }
  };

  const handleAddBill = async (data: any) => {
    if (data?.id) {
      setAlert({ type: 'success', message: 'Bill added successfully!' });
      await loadBills();
      return;
    }
    try {
      const res = await fetch('/api/finance/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          vendorId: data.vendorId || data.vendor,
          billDate: new Date().toISOString(),
          dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
          currency: 'NGN',
          items: [{
            description: data.description || 'Bill item',
            quantity: 1,
            unitPrice: parseFloat(data.amount) || 0,
          }],
        }),
      });
      if (!res.ok) throw new Error('Failed to create bill');
      setAlert({ type: 'success', message: 'Bill added successfully!' });
      await loadBills();
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to add bill' });
    }
  };

  const handleExport = async () => {
    const csvContent = [
      ['Bill #', 'Vendor', 'Amount', 'Due Date', 'Status'],
      ...filteredBills.map(b => [
        b.billNumber || b.id,
        vendorsMap[b.vendorId] || b.vendorId,
        formatCurrency(b.total, b.currency),
        b.dueDate || '',
        b.status
      ])
    ].map(row => row.join(',')).join('\n');

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bills-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#F8FAFC] mb-2">Bills & Payables Management</h2>
        <p className="text-[#94A3B8]">Process vendor bills, schedule payments, and track accounts payable</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#94A3B8]">Total Bills</p>
              <p className="text-xl font-bold text-[#F8FAFC]">{bills.length}</p>
            </div>
            <FileText className="w-8 h-8 text-[#818CF8]" />
          </div>
        </div>
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#94A3B8]">Outstanding</p>
              <p className="text-xl font-bold text-[#F8FAFC]">
                {formatCurrency(bills.reduce((sum, b) => sum + (b.balanceDue || 0), 0))}
              </p>
            </div>
            <Calculator className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#94A3B8]">Overdue</p>
              <p className="text-xl font-bold text-[#F8FAFC]">
                {formatCurrency(bills.filter(b => b.status === 'overdue').reduce((sum, b) => sum + (b.balanceDue || 0), 0))}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
        </div>
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#94A3B8]">Due This Week</p>
              <p className="text-xl font-bold text-[#F8FAFC]">
                {formatCurrency(bills.filter(b => {
                  if (!b.dueDate) return false;
                  const due = new Date(b.dueDate);
                  const now = new Date();
                  const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                  return diff >= 0 && diff <= 7 && b.balanceDue > 0;
                }).reduce((sum, b) => sum + (b.balanceDue || 0), 0))}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-[#818CF8]" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2 inline" />
            Add Bill
          </button>
          <button onClick={() => setShowPaymentModal(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            <CreditCard className="w-4 h-4 mr-2 inline" />
            Make Payment
          </button>
          <button onClick={() => setShowScheduleModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            <Calendar className="w-4 h-4 mr-2 inline" />
            Schedule Payments
          </button>
          <button onClick={handleExport} className="px-4 py-2 border border-[rgba(255,255,255,0.1)] text-[#F8FAFC] rounded-lg hover:bg-[rgba(255,255,255,0.02)]">
            <Download className="w-4 h-4 mr-2 inline" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-[#0B1120] px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-white">
            <option>All Status</option>
            <option>Draft</option>
            <option>Unpaid</option>
            <option>Partially Paid</option>
            <option>Paid</option>
            <option>Overdue</option>
          </select>
          <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className="bg-[#0B1120] px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-white">
            <option value="All">All Vendors</option>
            {Object.entries(vendorsMap).map(([id, name]) => (
              <option key={id} value={name}>{name}</option>
            ))}
          </select>
          <input 
            type="text" 
            placeholder="Search bills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-black"
          />
          <button className="px-4 py-2 bg-[rgba(255,255,255,0.07)] text-[#F8FAFC] rounded-lg hover:bg-[rgba(255,255,255,0.1)]">
            <Filter className="w-4 h-4 mr-2 inline" />
            More Filters
          </button>
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#F8FAFC]">Vendor Bills</h3>
          <span className="text-sm text-[#64748B]">Showing {filteredBills.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase">Bill #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase">Due Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#64748B] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredBills.map((bill, i) => (
                <tr key={bill.id || i} className="hover:bg-[rgba(255,255,255,0.02)]">
                  <td className="px-4 py-3 text-sm text-[#F8FAFC]">{bill.billNumber || bill.id}</td>
                  <td className="px-4 py-3 text-sm text-[#F8FAFC]">{vendorsMap[bill.vendorId] || bill.vendorId}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-[#F8FAFC]">{formatCurrency(bill.total, bill.currency)}</td>
                  <td className="px-4 py-3 text-sm text-[#F8FAFC]">{bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      bill.status === 'paid' ? 'bg-green-500/10 text-green-400' :
                      bill.status === 'overdue' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-100 text-yellow-800'
                    }`}>{bill.status.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="text-[#818CF8] hover:text-blue-800"><Eye className="w-4 h-4" /></button>
                      <button className="text-green-400 hover:text-green-800"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => setShowPaymentModal(true)} className="text-[#818CF8] hover:text-purple-800"><CreditCard className="w-4 h-4" /></button>
                      <button className="text-[#94A3B8] hover:text-[#94A3B8]"><Download className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Aging Analysis */}
      <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6 mb-8">
        <h3 className="text-lg font-semibold text-[#F8FAFC] mb-4">Accounts Payable Aging</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {agingBuckets.map((bucket, idx) => (
            <div key={idx} className="text-center p-4 bg-gray-50 rounded-lg">
              <p className={`text-2xl font-bold ${bucket.colorClass}`}>
                {formatCurrency(bucket.amount)}
              </p>
              <p className="text-sm text-[#94A3B8]">{bucket.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      <AddBillModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddBill}
        vendors={vendors}
        onVendorCreated={loadBills}
      />
      <MakePaymentModal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} onSubmit={() => setAlert({ type: 'success', message: 'Payment processed!' })} />
      <SchedulePaymentModal isOpen={showScheduleModal} onClose={() => setShowScheduleModal(false)} onSubmit={() => setAlert({ type: 'success', message: 'Payment scheduled!' })} />

      {alert && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white font-medium ${
          alert.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {alert.message}
        </div>
      )}
    </div>
  );
};

export default BillsComponent;
