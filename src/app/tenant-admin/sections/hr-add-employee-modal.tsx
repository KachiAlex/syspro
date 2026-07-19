'use client';

import React, { useState, useEffect } from 'react';
import { X, Upload, Link, Plus, Users, AlertCircle, CheckCircle, FileSpreadsheet, Download } from 'lucide-react';
import { HRService } from './hr-service';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  departments: string[];
  tenantSlug: string;
}

const CURRENCY_OPTIONS = [
  { code: 'USD', label: 'USD ($)' },
  { code: 'EUR', label: 'EUR (€)' },
  { code: 'GBP', label: 'GBP (£)' },
  { code: 'NGN', label: 'NGN (₦)' },
  { code: 'JPY', label: 'JPY (¥)' },
  { code: 'CAD', label: 'CAD (C$)' },
  { code: 'AUD', label: 'AUD (A$)' },
  { code: 'INR', label: 'INR (₹)' },
  { code: 'KES', label: 'KES (KSh)' },
  { code: 'GHS', label: 'GHS (₵)' },
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', NGN: '₦', JPY: '¥',
  CAD: 'C$', AUD: 'A$', INR: '₹', KES: 'KSh', GHS: '₵',
};

export const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({ isOpen, onClose, onSubmit, departments, tenantSlug }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'excel' | 'invite'>('manual');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [portalCredentials, setPortalCredentials] = useState<Array<{ name: string; email: string; password: string }> | null>(null);
  const [currency, setCurrency] = useState('USD');

  // Manual form data
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    department: '',
    position: '',
    startDate: '',
    salary: '',
    employmentType: 'Full-time',
    role: 'Staff'
  });

  // Fetch tenant currency when modal opens
  useEffect(() => {
    if (isOpen && tenantSlug) {
      HRService.getTenantCurrency(tenantSlug).then((c) => {
        if (c) setCurrency(c);
      }).catch(() => {});
    }
  }, [isOpen, tenantSlug]);

  // Clear warnings when switching to excel tab or opening modal
  useEffect(() => {
    if (isOpen && activeTab === 'excel') {
      setWarnings([]);
      setErrors({});
      setPortalCredentials(null);
    }
  }, [isOpen, activeTab]);

  // Excel upload data
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Invite link data
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [linkGenerated, setLinkGenerated] = useState(false);

  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      await onSubmit(formData);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        department: '',
        position: '',
        startDate: '',
        salary: '',
        employmentType: 'Full-time',
        role: 'Staff'
      });
      onClose();
    } catch (error) {
      console.error('Failed to add employee:', error);
      setErrors({ submit: 'Failed to add employee. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleExcelUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile) return;

    setLoading(true);
    setUploadProgress(0);
    setErrors({});
    setWarnings([]);

    try {
      const result = await HRService.importEmployeesFromExcel(tenantSlug, excelFile, 'demo123');

      setUploadProgress(100);
      setWarnings(result.warnings || []);
      setPortalCredentials(result.portalCredentials || null);

      if (result.failed > 0) {
        setErrors({ upload: `Imported ${result.imported}, failed ${result.failed}. ${(result.errors || []).slice(0, 3).join('; ')}` });
      } else if ((result.warnings || []).length > 0) {
        setErrors({ upload: `Imported ${result.imported} employees with ${(result.warnings || []).length} warning(s).` });
      } else {
        alert(`Successfully imported ${result.imported} employees. Portal accounts created with default password.`);
      }
    } catch (error: any) {
      console.error('Failed to upload employees:', error);
      const detail = error?.response?.data?.detail || error?.message || 'Upload failed. Please try again.';
      setErrors({ upload: detail });
    } finally {
      setLoading(false);
    }
  };

  const generateInviteLink = async () => {
    if (!inviteEmails.trim()) {
      setErrors({ emails: 'Please enter at least one email address' });
      return;
    }

    setLoading(true);
    try {
      const emails = inviteEmails.split('\n').filter(email => email.trim());
      const result = await HRService.generateInviteLink(tenantSlug, emails);
      setInviteLink(result.link);
      setLinkGenerated(true);
    } catch (error) {
      console.error('Failed to generate invite link:', error);
      setErrors({ invite: 'Failed to generate invite link. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      alert('Invite link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const downloadSampleFile = () => {
    const headers = ['firstName', 'lastName', 'email', 'department', 'position', 'startDate', 'salary', 'employmentType', 'role'];
    const sampleRows = [
      ['John', 'Doe', 'john.doe@example.com', 'Engineering', 'Software Engineer', '2026-01-15', '75000', 'full-time', 'staff'],
      ['Jane', 'Smith', 'jane.smith@example.com', 'Marketing', 'Marketing Manager', '2026-02-01', '85000', 'full-time', 'hod'],
      ['Michael', 'Brown', 'michael.brown@example.com', 'Sales', 'Sales Representative', '2026-03-10', '60000', 'contract', 'staff'],
    ];
    const csvContent = [headers, ...sampleRows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'employee-import-sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Add Employee</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mt-4">
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'manual'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Manual Entry
            </button>
            <button
              onClick={() => setActiveTab('excel')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'excel'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Excel Import
            </button>
            <button
              onClick={() => setActiveTab('invite')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'invite'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Invite Link
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

          {/* Manual Entry Tab */}
          {activeTab === 'manual' && (
            <form onSubmit={handleSubmitManual} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">First Name *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                    disabled={loading}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Last Name *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                    disabled={loading}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                    disabled={loading}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Department *</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                    className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                    disabled={loading}
                    required
                  >
                    <option value="">Select department</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Position *</label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                    className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                    disabled={loading}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Start Date *</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                    disabled={loading}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Salary</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500 text-sm">{CURRENCY_SYMBOLS[currency] || currency}</span>
                    <input
                      type="text"
                      value={formData.salary}
                      onChange={(e) => setFormData(prev => ({ ...prev, salary: e.target.value }))}
                      className="bg-white w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                      disabled={loading}
                      placeholder="65,000"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => {
                      const newCurrency = e.target.value;
                      setCurrency(newCurrency);
                      HRService.setTenantCurrency(tenantSlug, newCurrency).catch(() => {});
                    }}
                    className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                    disabled={loading}
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Employment Type</label>
                  <select
                    value={formData.employmentType}
                    onChange={(e) => setFormData(prev => ({ ...prev, employmentType: e.target.value }))}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                    className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                    disabled={loading}
                  >
                    <option value="Staff">Staff</option>
                    <option value="HOD">HOD</option>
                    <option value="Admin">Admin</option>
                    <option value="Executive">Executive</option>
                  </select>
                </div>
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
                  className="flex-1 px-4 py-2 bg-blue-600 text-black rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Adding...' : 'Add Employee'}
                </button>
              </div>
            </form>
          )}

          {/* Excel Import Tab */}
          {activeTab === 'excel' && (
            <form onSubmit={handleExcelUpload} className="space-y-6">
              <div className="text-center">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                  <Upload className="w-12 h-12 text-theme-text-tertiary mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Excel File</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Upload a CSV file with employee data. Required columns: firstName, lastName, email, department, position. Optional: startDate, salary, employmentType (full-time, part-time, contract, intern), role (staff, hod, admin, executive).
                  </p>

                  <button
                    type="button"
                    onClick={downloadSampleFile}
                    className="inline-flex items-center gap-2 px-4 py-2 mb-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Download Sample CSV
                  </button>

                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                    className="bg-white hidden text-black"
                    id="excel-upload"
                  />
                  
                  <label
                    htmlFor="excel-upload"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-black rounded-lg hover:bg-blue-700 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    Choose File
                  </label>
                  
                  {excelFile && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-600">Selected file: {excelFile.name}</p>
                    </div>
                  )}
                </div>
              </div>

              {uploadProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {errors.upload && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-700">{errors.upload}</span>
                  </div>
                </div>
              )}

              {warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-amber-800 text-sm max-h-32 overflow-y-auto">
                      <p className="font-medium mb-1">Warnings:</p>
                      {warnings.slice(0, 5).map((w, i) => (
                        <p key={i} className="text-amber-700">{w}</p>
                      ))}
                      {warnings.length > 5 && (
                        <p className="text-amber-600 italic">...and {warnings.length - 5} more</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {portalCredentials && portalCredentials.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div className="w-full">
                      <p className="font-medium text-emerald-800 text-sm mb-2">
                        Portal accounts created ({portalCredentials.length}) — Default password: <strong>demo123</strong>
                      </p>
                      <div className="max-h-40 overflow-y-auto text-xs">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-emerald-200">
                              <th className="py-1 pr-2 text-emerald-700">Name</th>
                              <th className="py-1 pr-2 text-emerald-700">Email</th>
                              <th className="py-1 text-emerald-700">Password</th>
                            </tr>
                          </thead>
                          <tbody>
                            {portalCredentials.slice(0, 10).map((c, i) => (
                              <tr key={i} className="border-b border-emerald-100">
                                <td className="py-1 pr-2 text-emerald-900">{c.name}</td>
                                <td className="py-1 pr-2 text-emerald-900">{c.email}</td>
                                <td className="py-1 text-emerald-900 font-mono">{c.password}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {portalCredentials.length > 10 && (
                          <p className="text-emerald-600 italic mt-1">...and {portalCredentials.length - 10} more</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                  className="flex-1 px-4 py-2 bg-blue-600 text-black rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  disabled={loading || !excelFile}
                >
                  {loading ? 'Uploading...' : 'Upload Employees'}
                </button>
              </div>
            </form>
          )}

          {/* Invite Link Tab */}
          {activeTab === 'invite' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  <Users className="w-4 h-4 inline mr-1" />
                  Email Addresses
                </label>
                <textarea
                  value={inviteEmails}
                  onChange={(e) => setInviteEmails(e.target.value)}
                  rows={4}
                  className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  placeholder="Enter email addresses, one per line or separated by commas"
                />
                {errors.emails && (
                  <p className="mt-1 text-sm text-red-600">{errors.emails}</p>
                )}
              </div>

              {!linkGenerated ? (
                <button
                  onClick={generateInviteLink}
                  disabled={loading || !inviteEmails.trim()}
                  className="w-full px-4 py-2 bg-blue-600 text-black rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Generating...' : 'Generate Invite Link'}
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-green-800 font-medium">Invite Link Generated!</span>
                    </div>
                    <p className="text-sm text-green-700 mb-3">
                      Share this link with your employees to complete their registration.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={inviteLink}
                        readOnly
                        className="flex-1 px-3 py-2 bg-white border border-green-300 rounded-lg text-sm text-black"
                      />
                      <button
                        onClick={copyInviteLink}
                        className="px-4 py-2 bg-green-600 text-black rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setLinkGenerated(false);
                      setInviteLink('');
                      setInviteEmails('');
                    }}
                    className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Generate Another Link
                  </button>
                </div>
              )}

              {errors.invite && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-700">{errors.invite}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
