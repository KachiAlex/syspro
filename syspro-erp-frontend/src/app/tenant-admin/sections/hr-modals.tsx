'use client';

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

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

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({ isOpen, onClose, onSubmit }) => {
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
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!formData.firstName || !formData.email || !formData.department) {
      setAlert({ type: 'error', message: 'Please fill in all required fields' });
      setLoading(false);
      return;
    }

    await new Promise(r => setTimeout(r, 1000));
    onSubmit(formData);
    setAlert({ type: 'success', message: 'Employee added successfully!' });
    setTimeout(() => {
      setFormData({ firstName: '', lastName: '', email: '', department: '', position: '', startDate: '', salary: '', employmentType: 'Full-time' });
      onClose();
    }, 1500);
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Employee</h3>
        {alert && <FormAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="First Name *" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          <input type="text" placeholder="Last Name" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="email" placeholder="Email *" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          <select value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
            <option value="">Select Department *</option>
            <option value="Engineering">Engineering</option>
            <option value="Sales">Sales</option>
            <option value="Marketing">Marketing</option>
            <option value="HR">HR</option>
            <option value="Finance">Finance</option>
          </select>
          <input type="text" placeholder="Position" value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="date" placeholder="Start Date" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="text" placeholder="Salary" value={formData.salary} onChange={(e) => setFormData({...formData, salary: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={formData.employmentType} onChange={(e) => setFormData({...formData, employmentType: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="Full-time">Full-time</option>
            <option value="Part-time">Part-time</option>
            <option value="Contract">Contract</option>
          </select>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{loading ? 'Adding...' : 'Add Employee'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EditEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  employee?: any;
}

export const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({ isOpen, onClose, onSubmit, employee }) => {
  const [formData, setFormData] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    department: '',
    position: '',
    startDate: '',
    salary: '',
    employmentType: 'Full-time'
  });
  const [loading, setLoading] = React.useState(false);
  const [alert, setAlert] = React.useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  React.useEffect(() => {
    if (employee && isOpen) {
      const nameParts = employee.name?.split(' ') || ['', ''];
      setFormData({
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        email: employee.email || '',
        department: employee.department || '',
        position: employee.position || '',
        startDate: employee.startDate || '',
        salary: employee.salary?.replace('$', '').replace(/,/g, '') || '',
        employmentType: employee.employmentType || 'Full-time'
      });
    }
  }, [employee, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!formData.firstName || !formData.email || !formData.department) {
      setAlert({ type: 'error', message: 'Please fill in all required fields' });
      setLoading(false);
      return;
    }

    await new Promise(r => setTimeout(r, 1000));
    onSubmit(formData);
    setAlert({ type: 'success', message: 'Employee updated successfully!' });
    setTimeout(() => {
      onClose();
    }, 1500);
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Employee</h3>
        {alert && <FormAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="First Name *" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          <input type="text" placeholder="Last Name" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="email" placeholder="Email *" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          <select value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
            <option value="">Select Department *</option>
            <option value="Engineering">Engineering</option>
            <option value="Sales">Sales</option>
            <option value="Marketing">Marketing</option>
            <option value="HR">HR</option>
            <option value="Finance">Finance</option>
          </select>
          <input type="text" placeholder="Position" value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="date" placeholder="Start Date" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="text" placeholder="Salary" value={formData.salary} onChange={(e) => setFormData({...formData, salary: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={formData.employmentType} onChange={(e) => setFormData({...formData, employmentType: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="Full-time">Full-time</option>
            <option value="Part-time">Part-time</option>
            <option value="Contract">Contract</option>
          </select>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">{loading ? 'Updating...' : 'Update Employee'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface RunPayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export const RunPayrollModal: React.FC<RunPayrollModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    payrollMonth: new Date().toISOString().slice(0, 7),
    payDate: '',
    includeBonuses: true,
    deductTaxes: true
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!formData.payrollMonth || !formData.payDate) {
      setAlert({ type: 'error', message: 'Please fill in all required fields' });
      setLoading(false);
      return;
    }

    await new Promise(r => setTimeout(r, 1200));
    onSubmit(formData);
    setAlert({ type: 'success', message: 'Payroll run initiated successfully!' });
    setTimeout(() => {
      onClose();
    }, 1500);
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Run Payroll</h3>
        {alert && <FormAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Payroll Month *</label>
            <input type="month" value={formData.payrollMonth} onChange={(e) => setFormData({...formData, payrollMonth: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Pay Date *</label>
            <input type="date" value={formData.payDate} onChange={(e) => setFormData({...formData, payDate: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={formData.includeBonuses} onChange={(e) => setFormData({...formData, includeBonuses: e.target.checked})} className="rounded" />
            <span className="text-sm text-gray-700">Include Bonuses</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={formData.deductTaxes} onChange={(e) => setFormData({...formData, deductTaxes: e.target.checked})} className="rounded" />
            <span className="text-sm text-gray-700">Deduct Taxes</span>
          </label>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">{loading ? 'Processing...' : 'Run Payroll'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface PostJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export const PostJobModal: React.FC<PostJobModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    title: '',
    department: '',
    description: '',
    requirements: '',
    salaryRange: '',
    jobType: 'Full-time'
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!formData.title || !formData.department || !formData.description) {
      setAlert({ type: 'error', message: 'Please fill in all required fields' });
      setLoading(false);
      return;
    }

    await new Promise(r => setTimeout(r, 1000));
    onSubmit(formData);
    setAlert({ type: 'success', message: 'Job posting created successfully!' });
    setTimeout(() => {
      setFormData({ title: '', department: '', description: '', requirements: '', salaryRange: '', jobType: 'Full-time' });
      onClose();
    }, 1500);
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Post Job Opening</h3>
        {alert && <FormAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Job Title *" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          <select value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
            <option value="">Select Department *</option>
            <option value="Engineering">Engineering</option>
            <option value="Sales">Sales</option>
            <option value="Marketing">Marketing</option>
            <option value="HR">HR</option>
            <option value="Finance">Finance</option>
          </select>
          <textarea placeholder="Job Description *" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={4} required />
          <textarea placeholder="Requirements" value={formData.requirements} onChange={(e) => setFormData({...formData, requirements: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} />
          <input type="text" placeholder="Salary Range" value={formData.salaryRange} onChange={(e) => setFormData({...formData, salaryRange: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={formData.jobType} onChange={(e) => setFormData({...formData, jobType: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="Full-time">Full-time</option>
            <option value="Part-time">Part-time</option>
            <option value="Contract">Contract</option>
          </select>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">{loading ? 'Posting...' : 'Post Job'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ViewEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: any;
  onEdit: (employee: any) => void;
  onAward: (employee: any) => void;
}

export const ViewEmployeeModal: React.FC<ViewEmployeeModalProps> = ({ isOpen, onClose, employee, onEdit, onAward }) => {
  const [loading, setLoading] = useState(false);

  const handleEdit = () => {
    setLoading(true);
    setTimeout(() => {
      onEdit(employee);
      setLoading(false);
      onClose();
    }, 800);
  };

  const handleAward = () => {
    setLoading(true);
    setTimeout(() => {
      onAward(employee);
      setLoading(false);
      onClose();
    }, 800);
  };

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{employee.name}</h3>
        <div className="space-y-3 mb-6">
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="text-sm font-medium text-gray-900">{employee.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Department</p>
            <p className="text-sm font-medium text-gray-900">{employee.department}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Position</p>
            <p className="text-sm font-medium text-gray-900">{employee.position}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              employee.status === 'Active' ? 'bg-green-100 text-green-800' :
              employee.status === 'On Leave' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
            }`}>{employee.status}</span>
          </div>
          <div>
            <p className="text-sm text-gray-600">Performance</p>
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              employee.performance === 'Excellent' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
            }`}>{employee.performance}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Close</button>
          <button onClick={handleEdit} disabled={loading} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">{loading ? '...' : 'Edit'}</button>
          <button onClick={handleAward} disabled={loading} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">{loading ? '...' : 'Award'}</button>
        </div>
      </div>
    </div>
  );
};

interface TrainingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export const TrainingModal: React.FC<TrainingModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    title: '',
    startDate: '',
    duration: '',
    maxParticipants: '',
    instructor: ''
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!formData.title || !formData.startDate || !formData.duration) {
      setAlert({ type: 'error', message: 'Please fill in all required fields' });
      setLoading(false);
      return;
    }

    await new Promise(r => setTimeout(r, 1000));
    onSubmit(formData);
    setAlert({ type: 'success', message: 'Training scheduled successfully!' });
    setTimeout(() => {
      setFormData({ title: '', startDate: '', duration: '', maxParticipants: '', instructor: '' });
      onClose();
    }, 1500);
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule Training</h3>
        {alert && <FormAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Training Title *" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          <input type="date" placeholder="Start Date *" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          <input type="text" placeholder="Duration (e.g., 4 weeks) *" value={formData.duration} onChange={(e) => setFormData({...formData, duration: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          <input type="number" placeholder="Max Participants" value={formData.maxParticipants} onChange={(e) => setFormData({...formData, maxParticipants: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="text" placeholder="Instructor" value={formData.instructor} onChange={(e) => setFormData({...formData, instructor: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{loading ? 'Scheduling...' : 'Schedule'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
