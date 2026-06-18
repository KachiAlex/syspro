'use client';

import React, { useState } from 'react';
import { X, Upload, Link, Plus, Users, AlertCircle, CheckCircle } from 'lucide-react';
import { HRService } from './hr-service';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  departments: string[];
}

export const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({ isOpen, onClose, onSubmit, departments }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'excel' | 'invite'>('manual');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Manual form data
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    department: '',
    position: '',
    startDate: '',
    salary: '',
    employmentType: 'Full-time'
  });

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
        employmentType: 'Full-time'
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

    try {
      const result = await HRService.importEmployeesFromExcel('tenant-slug', excelFile);
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      setUploadProgress(100);
      clearInterval(progressInterval);
      
      // Show success message with import results
      alert(`Successfully imported ${result.imported} employees. ${result.failed} failed.`);
      
      onClose();
    } catch (error) {
      console.error('Failed to upload employees:', error);
      setErrors({ upload: 'Failed to upload employees. Please try again.' });
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
      const result = await HRService.generateInviteLink('tenant-slug', emails);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Add Employee</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white">
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
                  : 'border-transparent text-gray-500 hover:text-white'
              }`}
            >
              Manual Entry
            </button>
            <button
              onClick={() => setActiveTab('excel')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'excel'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-white'
              }`}
            >
              Excel Import
            </button>
            <button
              onClick={() => setActiveTab('invite')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'invite'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-white'
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
                  <input
                    type="text"
                    value={formData.salary}
                    onChange={(e) => setFormData(prev => ({ ...prev, salary: e.target.value }))}
                    className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                    disabled={loading}
                    placeholder="e.g., $65,000"
                  />
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
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Excel File</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Upload an Excel file with employee data. The file should contain columns for: Name, Email, Department, Position, Start Date, and Salary.
                  </p>
                  
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                    className="bg-white hidden text-black"
                    id="excel-upload"
                  />
                  
                  <label
                    htmlFor="excel-upload"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
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
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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
                        className="flex-1 px-3 py-2 bg-white border border-green-300 rounded-lg text-sm"
                      />
                      <button
                        onClick={copyInviteLink}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
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
