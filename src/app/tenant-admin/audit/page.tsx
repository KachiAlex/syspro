'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FileText, Search, Filter, Download, Eye, Calendar, Clock, User, Shield, AlertTriangle, CheckCircle, XCircle, Server, Database, Mail, Settings, Users } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceType: string;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'failure' | 'warning';
  details: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

const auditLogs: AuditLog[] = [
  {
    id: '1',
    timestamp: '2024-04-03 14:30:15',
    userId: '1',
    userName: 'Sarah Johnson',
    action: 'User Login',
    resource: 'Admin Panel',
    resourceType: 'System',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    status: 'success',
    details: 'Successful login from corporate network',
    riskLevel: 'low'
  },
  {
    id: '2',
    timestamp: '2024-04-03 14:25:42',
    userId: '3',
    userName: 'Yuki Tanaka',
    action: 'Data Export',
    resource: 'Sales Report Q1 2024',
    resourceType: 'Report',
    ipAddress: '203.45.67.89',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    status: 'success',
    details: 'Exported 1,247 records to CSV format',
    riskLevel: 'medium'
  },
  {
    id: '3',
    timestamp: '2024-04-03 14:20:00',
    userId: '2',
    userName: 'James Wilson',
    action: 'Permission Change',
    resource: 'Michael Chen',
    resourceType: 'User',
    ipAddress: '172.16.0.45',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    status: 'success',
    details: 'Changed user role from Financial Analyst to Senior Financial Analyst',
    riskLevel: 'high'
  },
  {
    id: '4',
    timestamp: '2024-04-03 14:15:30',
    userId: 'unknown',
    userName: 'Unknown User',
    action: 'Failed Login Attempt',
    resource: 'Admin Panel',
    resourceType: 'System',
    ipAddress: '198.51.100.23',
    userAgent: 'Mozilla/5.0 (compatible; scanner/1.0)',
    status: 'failure',
    details: 'Failed login attempt with invalid credentials',
    riskLevel: 'high'
  },
  {
    id: '5',
    timestamp: '2024-04-03 14:10:15',
    userId: '5',
    userName: 'Ahmed Hassan',
    action: 'System Configuration',
    resource: 'Email Settings',
    resourceType: 'Settings',
    ipAddress: '185.123.45.67',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    status: 'success',
    details: 'Updated SMTP server configuration',
    riskLevel: 'medium'
  },
  {
    id: '6',
    timestamp: '2024-04-03 14:05:00',
    userId: '1',
    userName: 'Sarah Johnson',
    action: 'Database Backup',
    resource: 'Production Database',
    resourceType: 'Database',
    ipAddress: '10.0.0.15',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    status: 'success',
    details: 'Automated backup completed successfully (2.4GB)',
    riskLevel: 'low'
  },
  {
    id: '7',
    timestamp: '2024-04-03 14:00:30',
    userId: '4',
    userName: 'Michael Chen',
    action: 'Data Modification',
    resource: 'Customer Records',
    resourceType: 'Data',
    ipAddress: '203.45.67.89',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    status: 'warning',
    details: 'Bulk update of 245 customer records',
    riskLevel: 'medium'
  },
  {
    id: '8',
    timestamp: '2024-04-03 13:55:45',
    userId: 'system',
    userName: 'System',
    action: 'Security Alert',
    resource: 'Firewall Rules',
    resourceType: 'Security',
    ipAddress: 'localhost',
    userAgent: 'System Process',
    status: 'warning',
    details: 'Multiple failed login attempts detected from IP 198.51.100.23',
    riskLevel: 'critical'
  }
];

export default function AuditPage() {
  const { tenantSlug } = useTenantContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState('all');
  const [dateRange, setDateRange] = useState('today');
  const [selectedResourceType, setSelectedResourceType] = useState('all');

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.resource.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = selectedAction === 'all' || log.action === selectedAction;
    const matchesStatus = selectedStatus === 'all' || log.status === selectedStatus;
    const matchesRiskLevel = selectedRiskLevel === 'all' || log.riskLevel === selectedRiskLevel;
    const matchesResourceType = selectedResourceType === 'all' || log.resourceType === selectedResourceType;
    return matchesSearch && matchesAction && matchesStatus && matchesRiskLevel && matchesResourceType;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'failure': return 'bg-red-100 text-red-800';
      case 'warning': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failure': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'bg-blue-100 text-blue-800';
      case 'medium': return 'bg-amber-100 text-amber-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getResourceIcon = (resourceType: string) => {
    switch (resourceType) {
      case 'System': return <Server className="w-4 h-4" />;
      case 'Database': return <Database className="w-4 h-4" />;
      case 'User': return <Users className="w-4 h-4" />;
      case 'Settings': return <Settings className="w-4 h-4" />;
      case 'Report': return <FileText className="w-4 h-4" />;
      case 'Data': return <Database className="w-4 h-4" />;
      case 'Security': return <Shield className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const actions = [...new Set(auditLogs.map(l => l.action))];
  const resourceTypes = [...new Set(auditLogs.map(l => l.resourceType))];
  const successfulActions = auditLogs.filter(l => l.status === 'success').length;
  const failedActions = auditLogs.filter(l => l.status === 'failure').length;
  const warningActions = auditLogs.filter(l => l.status === 'warning').length;
  const criticalRisk = auditLogs.filter(l => l.riskLevel === 'critical').length;

  const exportLogs = () => {
    const csvContent = [
      ['Timestamp', 'User', 'Action', 'Resource', 'Status', 'Risk Level', 'IP Address', 'Details'],
      ...filteredLogs.map(log => [
        log.timestamp,
        log.userName,
        log.action,
        log.resource,
        log.status,
        log.riskLevel,
        log.ipAddress,
        log.details
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'audit_logs.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
          <p className="text-sm text-gray-600 mt-1">Activity logs and compliance tracking</p>
        </div>
        <Link
          href="/tenant-admin/admin"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ← Back to Admin
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Activities</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{auditLogs.length}</p>
              <p className="text-xs text-blue-600 mt-2">Last 24 hours</p>
            </div>
            <FileText className="w-12 h-12 text-blue-100" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Successful</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{successfulActions}</p>
              <p className="text-xs text-green-600 mt-2">{((successfulActions / auditLogs.length) * 100).toFixed(1)}% success rate</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-100" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Failed</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{failedActions}</p>
              <p className="text-xs text-red-600 mt-2">Requires attention</p>
            </div>
            <XCircle className="w-12 h-12 text-red-100" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Critical Risk</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{criticalRisk}</p>
              <p className="text-xs text-red-600 mt-2">Immediate action required</p>
            </div>
            <AlertTriangle className="w-12 h-12 text-red-100" />
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search audit logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7days">Last 7 Days</option>
            <option value="last30days">Last 30 Days</option>
          </select>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Actions</option>
            {actions.map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
            <option value="warning">Warning</option>
          </select>
          <select
            value={selectedRiskLevel}
            onChange={(e) => setSelectedRiskLevel(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Risk Levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <select
            value={selectedResourceType}
            onChange={(e) => setSelectedResourceType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Resources</option>
            {resourceTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <button
          onClick={exportLogs}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Level</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-900">{log.timestamp}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{log.userName}</p>
                        <p className="text-xs text-gray-500">ID: {log.userId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{log.action}</span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getResourceIcon(log.resourceType)}
                      <div>
                        <p className="text-sm text-gray-900">{log.resource}</p>
                        <p className="text-xs text-gray-500">{log.resourceType}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(log.status)}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                        {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskLevelColor(log.riskLevel)}`}>
                      {log.riskLevel.charAt(0).toUpperCase() + log.riskLevel.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{log.ipAddress}</span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                        <Eye className="w-3 h-3" />
                        <span className="hidden sm:inline">View</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Summary</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Most Active User</span>
              <span className="text-sm font-semibold text-gray-900">Sarah Johnson (3 actions)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Most Common Action</span>
              <span className="text-sm font-semibold text-blue-600">User Login</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">High Risk Activities</span>
              <span className="text-sm font-semibold text-orange-600">2</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Failed Login Attempts</span>
              <span className="text-sm font-semibold text-red-600">1</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Alerts</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Critical Security Alert</p>
                <p className="text-xs text-red-700">Multiple failed login attempts detected</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">High Risk Activity</p>
                <p className="text-xs text-amber-700">Permission changes detected</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Shield className="w-5 h-5 text-blue-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">System Update</p>
                <p className="text-xs text-blue-700">Database backup completed</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
