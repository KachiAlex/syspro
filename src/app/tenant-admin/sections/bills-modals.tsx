'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

interface FormAlertProps {
  type: 'success' | 'error' | 'info';
  message: string;
  onClose: () => void;
}

const FormAlert: React.FC<FormAlertProps> = ({ type, message, onClose }) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-50' : type === 'error' ? 'bg-red-50' : 'bg-blue-50';
  const textColor = type === 'success' ? 'text-green-800' : type === 'error' ? 'text-red-800' : 'text-blue-800';
  const borderColor = type === 'success' ? 'border-green-200' : type === 'error' ? 'border-red-200' : 'border-blue-200';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-4 mb-4 flex justify-between items-center`}>
      <p className={`text-sm font-medium ${textColor}`}>{message}</p>
      <button onClick={onClose} className="text-gray-500 hover:text-white">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

interface VendorOption {
  id: string;
  name: string;
}

interface AddBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  vendors?: VendorOption[];
  onVendorCreated?: () => void;
}

export const AddBillModal: React.FC<AddBillModalProps> = ({ isOpen, onClose, onSubmit, vendors: vendorsProp, onVendorCreated }) => {
  const { tenantSlug } = useTenantContext();
  const [vendors, setVendors] = useState<VendorOption[]>(vendorsProp || []);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [showCreateVendor, setShowCreateVendor] = useState(false);
  const [newVendor, setNewVendor] = useState({ name: '', email: '', phone: '', paymentTerms: 'net30' });
  const [creatingVendor, setCreatingVendor] = useState(false);

  const [formData, setFormData] = useState({
    vendor: '',
    billDate: '',
    dueDate: '',
    amount: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (vendorsProp && vendorsProp.length > 0) {
      setVendors(vendorsProp);
      return;
    }
    setVendorsLoading(true);
    fetch(`/api/finance/vendors?tenantSlug=${encodeURIComponent(tenantSlug)}`)
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data.vendors) ? data.vendors : [];
        setVendors(list.map((v: any) => ({ id: v.id, name: v.name || v.code || v.id })));
      })
      .catch(() => setAlert({ type: 'error', message: 'Failed to load vendors' }))
      .finally(() => setVendorsLoading(false));
  }, [isOpen, tenantSlug, vendorsProp]);

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendor.name.trim()) {
      setAlert({ type: 'error', message: 'Vendor name is required' });
      return;
    }
    setCreatingVendor(true);
    try {
      const res = await fetch(`/api/finance/vendors?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          name: newVendor.name.trim(),
          email: newVendor.email.trim() || undefined,
          phone: newVendor.phone.trim() || undefined,
          paymentTerms: newVendor.paymentTerms,
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error('Failed to create vendor');
      const data = await res.json();
      const created = data.vendor as VendorOption;
      setVendors(prev => [...prev, { id: created.id, name: created.name || created.id }]);
      setFormData(prev => ({ ...prev, vendor: created.id }));
      setShowCreateVendor(false);
      setNewVendor({ name: '', email: '', phone: '', paymentTerms: 'net30' });
      setAlert({ type: 'success', message: `Vendor "${created.name}" created!` });
      onVendorCreated?.();
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to create vendor. Please try again.' });
    } finally {
      setCreatingVendor(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.vendor || !formData.amount || !formData.dueDate) {
      setAlert({ type: 'error', message: 'Please fill in all required fields' });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/finance/bills?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantSlug,
          vendorId: formData.vendor,
          billDate: formData.billDate ? new Date(formData.billDate).toISOString() : new Date().toISOString(),
          dueDate: new Date(formData.dueDate).toISOString(),
          currency: 'NGN',
          items: [{
            description: formData.description || 'Bill payment',
            quantity: 1,
            unitPrice: parseFloat(formData.amount),
          }],
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create bill');
      }

      const result = await response.json();
      onSubmit(result.bill);
      setAlert({ type: 'success', message: 'Bill added successfully!' });
      setTimeout(() => {
        setFormData({ vendor: '', billDate: '', dueDate: '', amount: '', description: '' });
        setShowCreateVendor(false);
        onClose();
      }, 1500);
    } catch (error) {
      setAlert({ type: 'error', message: error instanceof Error ? error.message : 'Failed to create bill. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Bill</h3>
        {alert && <FormAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

        {showCreateVendor ? (
          <form onSubmit={handleCreateVendor} className="space-y-4">
            <h4 className="text-sm font-medium text-gray-900">Create New Vendor</h4>
            <input
              type="text"
              placeholder="Vendor Name *"
              value={newVendor.name}
              onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
              className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg text-black placeholder:text-gray-700"
              style={{ color: '#000000' }}
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={newVendor.email}
              onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
              className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg text-black placeholder:text-gray-700"
              style={{ color: '#000000' }}
            />
            <input
              type="text"
              placeholder="Phone"
              value={newVendor.phone}
              onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
              className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg text-black placeholder:text-gray-700"
              style={{ color: '#000000' }}
            />
            <select
              value={newVendor.paymentTerms}
              onChange={(e) => setNewVendor({ ...newVendor, paymentTerms: e.target.value })}
              className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
            >
              <option value="net30">Net 30</option>
              <option value="net60">Net 60</option>
              <option value="net90">Net 90</option>
              <option value="immediate">Immediate</option>
              <option value="cod">Cash on Delivery</option>
            </select>
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => { setShowCreateVendor(false); setNewVendor({ name: '', email: '', phone: '', paymentTerms: 'net30' }); }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={creatingVendor}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {creatingVendor ? 'Creating...' : 'Create Vendor'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Bill number is auto-generated by the backend */}
            <div className="relative">
              <select
                value={formData.vendor}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__create_new__') {
                    setShowCreateVendor(true);
                    setFormData(prev => ({ ...prev, vendor: '' }));
                  } else {
                    setFormData(prev => ({ ...prev, vendor: val }));
                  }
                }}
                className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
                required
                disabled={vendorsLoading}
              >
                <option value="">{vendorsLoading ? 'Loading vendors...' : 'Select Vendor *'}</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
                <option value="__create_new__">+ Create New Vendor</option>
              </select>
            </div>
            <input type="date" value={formData.billDate} onChange={(e) => setFormData({...formData, billDate: e.target.value})} className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg text-black" placeholder="Bill Date" />
            <input type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg text-black" placeholder="Due Date *" required />
            <input type="text" placeholder="Amount *" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg text-black" required />
            <textarea placeholder="Description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg text-black" rows={3} />
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{loading ? 'Adding...' : 'Add Bill'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

interface MakePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export const MakePaymentModal: React.FC<MakePaymentModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const { tenantSlug } = useTenantContext();
  const [bills, setBills] = useState<any[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [formData, setFormData] = useState({
    billId: '',
    billNumber: '',
    amount: '',
    paymentDate: '',
    method: 'Bank Transfer'
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !tenantSlug) return;
    setBillsLoading(true);
    fetch(`/api/finance/bills?tenantSlug=${encodeURIComponent(tenantSlug)}&limit=200`)
      .then(r => r.json())
      .then(data => {
        const list = (data.bills || []).filter((b: any) => b.status !== 'paid' && b.status !== 'cancelled');
        setBills(list);
      })
      .catch(() => setAlert({ type: 'error', message: 'Failed to load bills' }))
      .finally(() => setBillsLoading(false));
  }, [isOpen, tenantSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!formData.billId || !formData.amount || !formData.paymentDate) {
      setAlert({ type: 'error', message: 'Please select a bill and fill in all required fields' });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/finance/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantSlug,
          reference: formData.billNumber,
          billId: formData.billId,
          grossAmount: parseFloat(formData.amount),
          fees: 0,
          method: formData.method === 'Bank Transfer' ? 'bank_transfer' : formData.method.toLowerCase(),
          paymentDate: formData.paymentDate,
          confirmationDetails: `Payment for bill ${formData.billNumber}`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process payment');
      }

      const result = await response.json();
      onSubmit(result.payment);
      setAlert({ type: 'success', message: 'Payment processed successfully!' });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setAlert({ type: 'error', message: 'Failed to process payment. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Make Payment</h3>
        {alert && <FormAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
        <form onSubmit={handleSubmit} className="space-y-4">
          <select
            value={formData.billId}
            onChange={(e) => {
              const billId = e.target.value;
              const selected = bills.find((b: any) => b.id === billId);
              setFormData({
                ...formData,
                billId,
                billNumber: selected?.billNumber || selected?.id || '',
                amount: selected?.balanceDue ? selected.balanceDue.toString() : selected?.total ? selected.total.toString() : ''
              });
            }}
            className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
            required
            disabled={billsLoading}
          >
            <option value="">{billsLoading ? 'Loading bills...' : 'Select Bill *'}</option>
            {bills.map((b: any) => (
              <option key={b.id} value={b.id}>{b.billNumber || b.id} — {b.vendorId ? (b.vendorId) : ''} — ₦{(b.balanceDue || b.total || 0).toLocaleString()}</option>
            ))}
          </select>
          <input type="text" placeholder="Amount to Pay *" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg text-black" required />
          <input type="date" value={formData.paymentDate} onChange={(e) => setFormData({...formData, paymentDate: e.target.value})} className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg text-black" required />
          <select value={formData.method} onChange={(e) => setFormData({...formData, method: e.target.value})} className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg text-black">
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Check">Check</option>
            <option value="Credit Card">Credit Card</option>
            <option value="ACH">ACH</option>
          </select>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">{loading ? 'Processing...' : 'Pay Bill'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface SchedulePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export const SchedulePaymentModal: React.FC<SchedulePaymentModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const { tenantSlug } = useTenantContext();
  const [bills, setBills] = useState<any[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [formData, setFormData] = useState({
    billId: '',
    billNumber: '',
    paymentDate: '',
    amount: ''
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !tenantSlug) return;
    setBillsLoading(true);
    fetch(`/api/finance/bills?tenantSlug=${encodeURIComponent(tenantSlug)}&limit=200`)
      .then(r => r.json())
      .then(data => {
        const list = (data.bills || []).filter((b: any) => b.status !== 'paid' && b.status !== 'cancelled');
        setBills(list);
      })
      .catch(() => setAlert({ type: 'error', message: 'Failed to load bills' }))
      .finally(() => setBillsLoading(false));
  }, [isOpen, tenantSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!formData.billId || !formData.paymentDate || !formData.amount) {
      setAlert({ type: 'error', message: 'Please select a bill and fill in all required fields' });
      setLoading(false);
      return;
    }

    await new Promise(r => setTimeout(r, 800));
    onSubmit(formData);
    setAlert({ type: 'success', message: 'Payment scheduled successfully!' });
    setTimeout(() => {
      onClose();
    }, 1500);
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule Payment</h3>
        {alert && <FormAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
        <form onSubmit={handleSubmit} className="space-y-4">
          <select
            value={formData.billId}
            onChange={(e) => {
              const billId = e.target.value;
              const selected = bills.find((b: any) => b.id === billId);
              setFormData({
                ...formData,
                billId,
                billNumber: selected?.billNumber || selected?.id || '',
                amount: selected?.balanceDue ? selected.balanceDue.toString() : selected?.total ? selected.total.toString() : ''
              });
            }}
            className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
            required
            disabled={billsLoading}
          >
            <option value="">{billsLoading ? 'Loading bills...' : 'Select Bill *'}</option>
            {bills.map((b: any) => (
              <option key={b.id} value={b.id}>{b.billNumber || b.id} — {b.vendorId ? (b.vendorId) : ''} — ₦{(b.balanceDue || b.total || 0).toLocaleString()}</option>
            ))}
          </select>
          <input type="date" value={formData.paymentDate} onChange={(e) => setFormData({...formData, paymentDate: e.target.value})} className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg text-black" placeholder="Schedule Date *" required />
          <input type="text" placeholder="Amount *" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg text-black" required />
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-purple-600 text-gray-900 rounded-lg hover:bg-purple-700 disabled:opacity-50">{loading ? 'Scheduling...' : 'Schedule'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
