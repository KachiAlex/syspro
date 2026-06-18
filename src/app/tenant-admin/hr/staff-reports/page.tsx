'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Download } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { HRService } from '@/app/tenant-admin/sections/hr-service';

interface Employee {
  id: string;
  name: string;
  department: string;
  status: string;
  salary?: string;
}

interface Report {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

export default function ReportsPage() {
  const { tenantSlug } = useTenantContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const [fetchedEmployees, fetchedReports] = await Promise.all([
        HRService.getEmployees(tenantSlug).catch(() => []),
        HRService.getReports(tenantSlug).catch(() => []),
      ]);
      setEmployees(fetchedEmployees.map((e: any) => ({
        id: e.id,
        name: e.name,
        department: e.department,
        status: e.status,
        salary: e.salary,
      })));
      setReports(fetchedReports.map((r: any) => ({
        id: r.id,
        name: r.name,
        status: r.status || 'Available',
        createdAt: r.createdAt || r.created_at || '',
      })));
    } catch (error) {
      console.error('Failed to load reports data:', error);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const departmentCounts = employees.reduce((acc, emp) => {
    acc[emp.department] = (acc[emp.department] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const departmentData = Object.entries(departmentCounts).map(([dept, count]) => ({
    dept,
    count,
    percentage: employees.length > 0 ? Math.round((count / employees.length) * 100) : 0,
  }));

  const salaryRanges = [
    { label: '$40K - $60K', min: 40000, max: 60000 },
    { label: '$60K - $80K', min: 60000, max: 80000 },
    { label: '$80K - $100K', min: 80000, max: 100000 },
    { label: '$100K+', min: 100000, max: Infinity },
  ];
  const withSalaries = employees.filter(e => e.salary);
  const totalWithSalary = withSalaries.length;
  const salaryData = salaryRanges.map((range) => {
    const count = withSalaries.filter(e => {
      const s = parseFloat(e.salary?.replace(/[$,]/g, '') || '0');
      return s >= range.min && s < range.max;
    }).length;
    const percentage = totalWithSalary > 0 ? Math.round((count / totalWithSalary) * 100) : 0;
    return { range: range.label, count, percentage };
  });

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">HR Reports & Analytics</h2>
        <div className="text-center py-12 text-gray-500">Loading reports data...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">HR Reports & Analytics</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Workforce Summary</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Employees</span>
              <span className="font-semibold text-gray-900">{employees.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Active</span>
              <span className="font-semibold text-green-600">{employees.filter(e => e.status === 'Active').length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">On Leave</span>
              <span className="font-semibold text-amber-600">{employees.filter(e => e.status === 'On Leave').length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Departments</span>
              <span className="font-semibold text-blue-600">{new Set(employees.map(e => e.department)).size}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Key Metrics</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Employees</span>
              <span className="font-semibold text-gray-900">{employees.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Active</span>
              <span className="font-semibold text-green-600">{employees.filter(e => e.status === 'Active').length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">On Leave</span>
              <span className="font-semibold text-amber-600">{employees.filter(e => e.status === 'On Leave').length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Departments</span>
              <span className="font-semibold text-blue-600">{new Set(employees.map(e => e.department)).size}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Salary Distribution</h4>
        {totalWithSalary > 0 ? (
          <div className="space-y-3">
            {salaryData.map((item) => (
              <div key={item.range}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">{item.range}</span>
                  <span className="text-sm font-semibold text-gray-900">{item.count} ({item.percentage}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No salary data available.</p>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Department Breakdown</h4>
        {departmentData.length > 0 ? (
          <div className="space-y-3">
            {departmentData.map((item) => (
              <div key={item.dept}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">{item.dept}</span>
                  <span className="text-sm font-semibold text-gray-900">{item.count} ({item.percentage}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No department data available.</p>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Generated Reports</h4>
        {reports.length > 0 ? (
          <div className="space-y-3">
            {reports.map((report) => (
              <div key={report.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{report.name}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {report.createdAt ? `Created: ${report.createdAt}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {report.status}
                  </span>
                  <button className="text-blue-600 hover:text-theme-accent-hover text-sm font-medium">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No reports generated yet.</p>
        )}
      </div>
    </div>
  );
}
