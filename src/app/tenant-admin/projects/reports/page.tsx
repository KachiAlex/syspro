'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Download, TrendingUp, BarChart3, Calendar, Plus, Send, FileText, Users } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { StaffReportModal } from '../components/StaffReportModal';
import { AdminReportModal } from '../components/AdminReportModal';

interface UserRole {
  canViewReports: boolean;
  canSubmitReports: boolean;
  canCreateReports: boolean;
  reportingLevel: 'staff' | 'admin' | 'superadmin';
}

interface Project {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  role: string;
  level: 'staff' | 'admin' | 'superadmin';
}

export default function ProjectReportsPage() {
  const { tenantSlug } = useTenantContext();
  const [userRole, setUserRole] = useState<UserRole>({
    canViewReports: true,
    canSubmitReports: false,
    canCreateReports: false,
    reportingLevel: 'staff'
  });
  const [currentUser, setCurrentUser] = useState('John Doe');
  const [projects, setProjects] = useState<Project[]>([]);
  const [availableRecipients, setAvailableRecipients] = useState<User[]>([]);
  
  // Modal states
  const [showStaffReportModal, setShowStaffReportModal] = useState(false);
  const [showAdminReportModal, setShowAdminReportModal] = useState(false);

  useEffect(() => {
    setUserRole({
      canViewReports: true,
      canSubmitReports: false,
      canCreateReports: false,
      reportingLevel: 'staff'
    });
    setProjects([]);
    setAvailableRecipients([]);
  }, []);

  const handleStaffReportSubmit = async (reportData: any) => {
    try {
      // API call to submit staff report
      console.log('Submitting staff report:', reportData);
      // In real app: await apiClient.post('/api/projects/reports/submit', reportData);
    } catch (error) {
      console.error('Failed to submit staff report:', error);
      throw error;
    }
  };

  const handleAdminReportSubmit = async (reportData: any) => {
    try {
      // API call to create admin report
      console.log('Creating admin report:', reportData);
      // In real app: await apiClient.post('/api/projects/reports/create', reportData);
    } catch (error) {
      console.error('Failed to create admin report:', error);
      throw error;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Project Reports & Analytics</h2>
        <div className="flex items-center gap-3">
          {/* Role-based action buttons */}
          {userRole.canSubmitReports && (
            <button
              onClick={() => setShowStaffReportModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Submit Report
            </button>
          )}
          
          {userRole.canCreateReports && (
            <button
              onClick={() => setShowAdminReportModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              Create Report
            </button>
          )}
          
          <Link
            href={`/tenant-admin/projects`}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ← Back to Overview
          </Link>
        </div>
      </div>

      {/* User role indicator */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-gray-900">
              Current Role: {userRole.reportingLevel.charAt(0).toUpperCase() + userRole.reportingLevel.slice(1)}
            </p>
            <p className="text-xs text-blue-700 mt-1">
              {userRole.canSubmitReports && '• Can submit reports '}
              {userRole.canCreateReports && '• Can create reports '}
              {userRole.canViewReports && '• Can view reports'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600 mb-2">Total Projects</p>
          <p className="text-3xl font-bold text-gray-900">12</p>
          <p className="text-xs text-gray-500 mt-2">All time</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600 mb-2">Completion Rate</p>
          <p className="text-3xl font-bold text-green-600">65%</p>
          <p className="text-xs text-gray-500 mt-2">Overall progress</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600 mb-2">Total Budget</p>
          <p className="text-3xl font-bold text-blue-600">$455K</p>
          <p className="text-xs text-gray-500 mt-2">Allocated</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600 mb-2">Avg Duration</p>
          <p className="text-3xl font-bold text-purple-600">4.5mo</p>
          <p className="text-xs text-gray-500 mt-2">Per project</p>
        </div>
      </div>

      {/* Reports received from staff (for admins) */}
      {userRole.reportingLevel !== 'staff' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Reports Received from Staff</h3>
          <div className="space-y-3">
            {[
              { 
                id: '1', 
                project: 'Website Redesign', 
                submittedBy: 'John Smith', 
                type: 'Daily Report', 
                date: '2026-04-04',
                status: 'reviewed'
              },
              { 
                id: '2', 
                project: 'Mobile App Development', 
                submittedBy: 'Sarah Johnson', 
                type: 'Weekly Report', 
                date: '2026-04-03',
                status: 'pending'
              },
              { 
                id: '3', 
                project: 'API Integration', 
                submittedBy: 'Mike Davis', 
                type: 'Milestone Report', 
                date: '2026-04-02',
                status: 'reviewed'
              },
            ].map((report) => (
              <div key={report.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900">{report.project}</p>
                  <p className="text-sm text-gray-600">
                    {report.type} by {report.submittedBy} • {report.date}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    report.status === 'reviewed' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {report.status}
                  </span>
                  <button className="text-blue-600 hover:text-blue-700">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Reports */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Reports</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            'Project Summary Report',
            'Budget Analysis Report',
            'Timeline Variance Report',
            'Resource Utilization Report',
            'Risk Assessment Report',
            'Quality Metrics Report',
            'Team Performance Report',
            'Stakeholder Status Report',
          ].map((report, idx) => (
            <button
              key={idx}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-900">{report}</span>
              <Download className="w-4 h-4 text-blue-600" />
            </button>
          ))}
        </div>
      </div>

      {/* Modals */}
      <StaffReportModal
        isOpen={showStaffReportModal}
        onClose={() => setShowStaffReportModal(false)}
        onSubmit={handleStaffReportSubmit}
        projects={projects}
        currentUser={currentUser}
      />

      <AdminReportModal
        isOpen={showAdminReportModal}
        onClose={() => setShowAdminReportModal(false)}
        onSubmit={handleAdminReportSubmit}
        projects={projects}
        availableRecipients={availableRecipients}
        currentUser={currentUser}
      />
    </div>
  );
}
