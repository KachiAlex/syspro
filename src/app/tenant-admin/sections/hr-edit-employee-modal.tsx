'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Pencil, KeyRound, Lock, Unlock, CheckCircle, Copy, RefreshCw } from 'lucide-react';
import { HRService } from './hr-service';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  role: string;
  startDate: string;
  status: string;
  salary?: string;
  employmentType?: string;
  isPortalActive?: boolean;
  lastLogin?: string | null;
}

interface EditEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  employee: Employee | null;
  departments: string[];
  tenantSlug: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', NGN: '₦', JPY: '¥',
  CAD: 'C$', AUD: 'A$', INR: '₹', KES: 'KSh', GHS: '₵',
};

export const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  employee,
  departments,
  tenantSlug,
}) => {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currency, setCurrency] = useState('USD');

  // Portal access state
  const [portalMode, setPortalMode] = useState<'none' | 'custom' | 'generate'>('none');
  const [portalPassword, setPortalPassword] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalCredentials, setPortalCredentials] = useState<{ name: string; email: string; password: string } | null>(null);
  const [portalError, setPortalError] = useState('');
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    department: '',
    position: '',
    startDate: '',
    salary: '',
    employmentType: 'Full-time',
    role: 'Staff',
    status: 'Active',
  });

  useEffect(() => {
    if (isOpen && tenantSlug) {
      HRService.getTenantCurrency(tenantSlug).then((c) => {
        if (c) setCurrency(c);
      }).catch(() => {});
    }
  }, [isOpen, tenantSlug]);

  useEffect(() => {
    if (employee) {
      const nameParts = employee.name.split(' ');
      setFormData({
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        email: employee.email || '',
        department: employee.department || '',
        position: employee.position || '',
        startDate: employee.startDate || '',
        salary: employee.salary ? employee.salary.replace(/[^0-9.]/g, '') : '',
        employmentType: employee.employmentType || 'Full-time',
        role: employee.role || 'Staff',
        status: employee.status || 'Active',
      });
      // Reset portal state when opening for a different employee
      setPortalMode('none');
      setPortalPassword('');
      setPortalCredentials(null);
      setPortalError('');
    }
  }, [employee]);

  const handleSetPortalPassword = async () => {
    if (!employee || !tenantSlug) return;
    if (portalMode === 'custom' && portalPassword.length < 6) {
      setPortalError('Password must be at least 6 characters.');
      return;
    }
    setPortalLoading(true);
    setPortalError('');
    try {
      const creds = await HRService.setEmployeePortalPassword(
        tenantSlug,
        employee.id,
        portalMode === 'custom' ? portalPassword : undefined
      );
      setPortalCredentials(creds);
      setPortalMode('none');
      setPortalPassword('');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to set password.';
      setPortalError(msg);
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!portalCredentials) return;
    const text = `Email: ${portalCredentials.email}\nPassword: ${portalCredentials.password}\nLogin URL: ${window.location.origin}/employee/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeactivatePortal = async () => {
    if (!employee || !tenantSlug) return;
    setPortalLoading(true);
    setPortalError('');
    try {
      await HRService.deactivateEmployeePortal(tenantSlug, employee.id);
      setPortalCredentials(null);
    } catch (err: any) {
      setPortalError(err?.message || 'Failed to deactivate portal.');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      await onSubmit(formData);
      onClose();
    } catch (error: any) {
      console.error('Failed to update employee:', error);
      const msg = error?.response?.data?.error || error?.message || 'Failed to update employee. Please try again.';
      setErrors({ submit: msg });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-600" />
              Edit Employee
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-700">{errors.submit}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">First Name</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                  className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Last Name</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                  className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Department</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData((prev) => ({ ...prev, department: e.target.value }))}
                  className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  disabled={loading}
                >
                  <option value="">Select department</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Position</label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData((prev) => ({ ...prev, position: e.target.value }))}
                  className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Salary</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500 text-sm">{CURRENCY_SYMBOLS[currency] || currency}</span>
                  <input
                    type="text"
                    value={formData.salary}
                    onChange={(e) => setFormData((prev) => ({ ...prev, salary: e.target.value }))}
                    className="bg-white w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                    disabled={loading}
                    placeholder="65,000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Employment Type</label>
                <select
                  value={formData.employmentType}
                  onChange={(e) => setFormData((prev) => ({ ...prev, employmentType: e.target.value }))}
                  className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  disabled={loading}
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Intern">Intern</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value }))}
                  className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  disabled={loading}
                >
                  <option value="Staff">Staff</option>
                  <option value="HOD">HOD</option>
                  <option value="Admin">Admin</option>
                  <option value="Executive">Executive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                  className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  disabled={loading}
                >
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Terminated">Terminated</option>
                </select>
              </div>
            </div>

            {/* Portal Access Section */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-600" />
                Portal Access
              </h3>

              {/* Portal status badge */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  {employee.isPortalActive ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <Unlock className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      <Lock className="w-3 h-3" />
                      Inactive
                    </span>
                  )}
                </div>
                {employee.lastLogin && (
                  <span className="text-xs text-gray-500">
                    Last login: {new Date(employee.lastLogin).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Credentials display after setting password */}
              {portalCredentials && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-green-800">
                      Portal password set for <strong>{portalCredentials.name}</strong>. Share these credentials securely — they won't be shown again.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 bg-white rounded-lg p-3 border border-green-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Email</span>
                      <span className="text-sm font-mono text-gray-900">{portalCredentials.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Password</span>
                      <span className="text-sm font-mono text-gray-900">{portalCredentials.password}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Login URL</span>
                      <span className="text-sm font-mono text-gray-900">{typeof window !== 'undefined' ? `${window.location.origin}/employee/login` : '/employee/login'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopyCredentials}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                    >
                      {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : 'Copy All'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPortalCredentials(null)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Portal error */}
              {portalError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-700">{portalError}</span>
                  </div>
                </div>
              )}

              {/* Portal action buttons */}
              {portalMode === 'none' && !portalCredentials && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPortalMode('custom')}
                    disabled={portalLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    {employee.isPortalActive ? 'Set Custom Password' : 'Activate with Custom Password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPortalMode('generate')}
                    disabled={portalLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {employee.isPortalActive ? 'Generate New Password' : 'Activate with Generated Password'}
                  </button>
                  {employee.isPortalActive && (
                    <button
                      type="button"
                      onClick={handleDeactivatePortal}
                      disabled={portalLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Deactivate Portal
                    </button>
                  )}
                </div>
              )}

              {/* Custom password input */}
              {portalMode === 'custom' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Custom Password</label>
                    <input
                      type="text"
                      value={portalPassword}
                      onChange={(e) => setPortalPassword(e.target.value)}
                      placeholder="Enter a password (min 6 characters)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                      disabled={portalLoading}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSetPortalPassword}
                      disabled={portalLoading || portalPassword.length < 6}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {portalLoading ? 'Saving...' : 'Set Password & Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPortalMode('none'); setPortalPassword(''); }}
                      disabled={portalLoading}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Generate password confirmation */}
              {portalMode === 'generate' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    A secure password will be generated automatically and shown once for you to share with the employee.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSetPortalPassword}
                      disabled={portalLoading}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {portalLoading ? 'Generating...' : 'Generate & Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPortalMode('none')}
                      disabled={portalLoading}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
