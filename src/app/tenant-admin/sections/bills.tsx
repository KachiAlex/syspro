'use client';

import React, { useState } from 'react';
import { Plus, Eye, Edit, CreditCard, Download, Filter, FileText, Calculator, AlertCircle, Calendar } from 'lucide-react';
import { AddBillModal, MakePaymentModal, SchedulePaymentModal } from './bills-modals';

interface Bills {
  tenantSlug: string;
}

interface Bill {
  id: string;
  vendor: string;
  amount: string;
  dueDate: string;
  status: string;
}

const BillsComponent: React.FC<Bills> = ({ tenantSlug }) => {
  const [bills, setBills] = useState<Bill[]>([
    { id: 'BILL-2024-045', vendor: 'Tech Solutions Inc', amount: '$12,450.00', dueDate: '2024-03-15', status: 'Unpaid' },
    { id: 'BILL-2024-044', vendor: 'Office Supply Co', amount: '$3,750.00', dueDate: '2024-03-10', status: 'Partially Paid' }
  ]);

  const [statusFilter, setStatusFilter] = useState('All');
  const [vendorFilter, setVendorFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const filteredBills = bills.filter(bill => {
    if (statusFilter !== 'All' && bill.status !== statusFilter) return false;
    if (vendorFilter !== 'All' && bill.vendor !== vendorFilter) return false;
    if (searchQuery && !bill.id.includes(searchQuery)) return false;
    return true;
  });

  const handleAddBill = (data: any) => {
    const newBill: Bill = {
      id: data.billNumber || `BILL-${Date.now()}`,
      vendor: data.vendor,
      amount: `$${parseFloat(data.amount).toLocaleString('en-US', {minimumFractionDigits: 2})}`,
      dueDate: data.dueDate,
      status: 'Draft'
    };
    setBills([...bills, newBill]);
    setAlert({ type: 'success', message: 'Bill added successfully!' });
  };

  const handleExport = async () => {
    const csvContent = [
      ['Bill #', 'Vendor', 'Amount', 'Due Date', 'Status'],
      ...filteredBills.map(b => [b.id, b.vendor, b.amount, b.dueDate, b.status])
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Bills & Payables Management</h2>
        <p className="text-gray-600">Process vendor bills, schedule payments, and track accounts payable</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Bills</p>
              <p className="text-xl font-bold text-gray-900">{bills.length}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Outstanding</p>
              <p className="text-xl font-bold text-gray-900">$89,234</p>
            </div>
            <Calculator className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Overdue</p>
              <p className="text-xl font-bold text-gray-900">$12,450</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Due This Week</p>
              <p className="text-xl font-bold text-gray-900">$23,567</p>
            </div>
            <Calendar className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
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
          <button onClick={handleExport} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4 mr-2 inline" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
            <option>All Status</option>
            <option>Draft</option>
            <option>Unpaid</option>
            <option>Partially Paid</option>
            <option>Paid</option>
            <option>Overdue</option>
          </select>
          <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
            <option value="All">All Vendors</option>
            <option value="Tech Solutions Inc">Tech Solutions Inc</option>
            <option value="Office Supply Co">Office Supply Co</option>
          </select>
          <input 
            type="text" 
            placeholder="Search bills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            <Filter className="w-4 h-4 mr-2 inline" />
            More Filters
          </button>
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Vendor Bills</h3>
          <span className="text-sm text-gray-500">Showing {filteredBills.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bill #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredBills.map((bill, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{bill.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{bill.vendor}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{bill.amount}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{bill.dueDate}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      bill.status === 'Paid' ? 'bg-green-100 text-green-800' :
                      bill.status === 'Overdue' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>{bill.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="text-blue-600 hover:text-blue-800"><Eye className="w-4 h-4" /></button>
                      <button className="text-green-600 hover:text-green-800"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => setShowPaymentModal(true)} className="text-purple-600 hover:text-purple-800"><CreditCard className="w-4 h-4" /></button>
                      <button className="text-gray-600 hover:text-gray-800"><Download className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Aging Analysis */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Accounts Payable Aging</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">$12,450</p>
            <p className="text-sm text-gray-600">Over 90 Days</p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <p className="text-2xl font-bold text-orange-600">$23,567</p>
            <p className="text-sm text-gray-600">61-90 Days</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">$34,789</p>
            <p className="text-sm text-gray-600">31-60 Days</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">$45,678</p>
            <p className="text-sm text-gray-600">0-30 Days</p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddBillModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSubmit={handleAddBill} />
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
