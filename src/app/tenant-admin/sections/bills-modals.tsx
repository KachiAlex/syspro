'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';

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
      <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

interface AddBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export const AddBillModal: React.FC<AddBillModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    billNumber: '',
    vendor: '',
    billDate: '',
    dueDate: '',
    amount: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!formData.vendor || !formData.amount || !formData.dueDate) {
      setAlert({ type: 'error', message: 'Please fill in all required fields' });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/finance/bills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantSlug: 'default',
          vendorId: formData.vendor,
          billDate: formData.billDate || new Date().toISOString(),
          dueDate: formData.dueDate,
          currency: 'NGN',
          items: [{
            description: formData.description || 'Bill payment',
            quantity: 1,
            unitPrice: parseFloat(formData.amount),
          }],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create bill');
      }

      const result = await response.json();
      onSubmit(result.bill);
      setAlert({ type: 'success', message: 'Bill added successfully!' });
      setTimeout(() => {
        setFormData({ billNumber: '', vendor: '', billDate: '', dueDate: '', amount: '', description: '' });
        onClose();
      }, 1500);
    } catch (error) {
      setAlert({ type: 'error', message: 'Failed to create bill. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Bill</h3>
        {alert && <FormAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Bill Number" value={formData.billNumber} onChange={(e) => setFormData({...formData, billNumber: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          <select value={formData.vendor} onChange={(e) => setFormData({...formData, vendor: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
            <option value="">Select Vendor *</option>
            <option value="Tech Solutions Inc">Tech Solutions Inc</option>
            <option value="Office Supply Co">Office Supply Co</option>
            <option value="Global Logistics Ltd">Global Logistics Ltd</option>
            <option value="Manufacturing Partners Inc">Manufacturing Partners Inc</option>
          </select>
          <input type="date" value={formData.billDate} onChange={(e) => setFormData({...formData, billDate: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Bill Date" />
          <input type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Due Date *" required />
          <input type="text" placeholder="Amount *" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
          <textarea placeholder="Description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={3} />
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{loading ? 'Adding...' : 'Add Bill'}</button>
          </div>
        </form>
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
  const [formData, setFormData] = useState({
    billNumber: '',
    amount: '',
    paymentDate: '',
    method: 'Bank Transfer'
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!formData.billNumber || !formData.amount || !formData.paymentDate) {
      setAlert({ type: 'error', message: 'Please fill in all required fields' });
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
          tenantSlug: 'default',
          reference: formData.billNumber,
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
          <input type="text" placeholder="Bill Number *" value={formData.billNumber} onChange={(e) => setFormData({...formData, billNumber: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
          <input type="text" placeholder="Amount to Pay *" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
          <input type="date" value={formData.paymentDate} onChange={(e) => setFormData({...formData, paymentDate: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
          <select value={formData.method} onChange={(e) => setFormData({...formData, method: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Check">Check</option>
            <option value="Credit Card">Credit Card</option>
            <option value="ACH">ACH</option>
          </select>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
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
  const [formData, setFormData] = useState({
    billNumber: '',
    paymentDate: '',
    amount: ''
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!formData.billNumber || !formData.paymentDate || !formData.amount) {
      setAlert({ type: 'error', message: 'Please fill in all required fields' });
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
          <input type="text" placeholder="Bill Number *" value={formData.billNumber} onChange={(e) => setFormData({...formData, billNumber: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
          <input type="date" value={formData.paymentDate} onChange={(e) => setFormData({...formData, paymentDate: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Schedule Date *" required />
          <input type="text" placeholder="Amount *" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">{loading ? 'Scheduling...' : 'Schedule'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
