'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Search, Download, Clock, User, Shield, AlertTriangle, CheckCircle, XCircle, Server, Database, Settings, Users } from 'lucide-react';
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
  status: 'success' | 'failure' | 'warning';
  details: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

function inferResourceType(resource: string): string {
  const r = (resource || '').toLowerCase();
  if (r.includes('user') || r.includes('employee') || r.includes('role') || r.includes('permission')) return 'User';
  if (r.includes('database') || r.includes('backup')) return 'Database';
  if (r.includes('setting') || r.includes('config')) return 'Settings';
  if (r.includes('report')) return 'Report';
  if (r.includes('data') || r.includes('record') || r.includes('customer')) return 'Data';
  if (r.includes('security') || r.includes('firewall') || r.includes('login') || r.includes('auth')) return 'Security';
  return 'System';
}

export default function AuditPage() {
  const { tenantSlug } = useTenantContext();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState('all');
  const [dateRange, setDateRange] = useState('today');
  const [selectedResourceType, setSelectedResourceType] = useState('all');

  useEffect(() => {
    if (!tenantSlug) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/tenant/audit?tenantSlug=${encodeURIComponent(tenantSlug)}`)
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || 'Failed to load audit logs');
        const logs: AuditLog[] = (payload.logs || []).map((row: any) => ({
          id: String(row.id),
          timestamp: row.timestamp ? new Date(row.timestamp).toLocaleString() : '—',
          userId: row.user || 'system',
          userName: row.user || 'system',
          action: row.action || 'Unknown action',
          resource: row.resource || '—',
          resourceType: inferResourceType(row.resource || ''),
          ipAddress: '—',
          status: 'success',
          details: row.details || '',
          riskLevel: 'low',
        }));
        if (!cancelled) setAuditLogs(logs);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load audit logs');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  const filteredLogs = auditLogs.filter(log => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = log.userName.toLowerCase().includes(term) ||
                         log.action.toLowerCase().includes(term) ||
                         log.resource.toLowerCase().includes(term);
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
      default: return 'bg-theme-muted text-theme-text-primary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failure': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      default: return <AlertTriangle className="w-4 h-4 text-theme-text-secondary" />;
    }
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'bg-blue-100 text-blue-800';
      case 'medium': return 'bg-amber-100 text-amber-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-theme-muted text-theme-text-primary';
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
  const criticalRisk = auditLogs.filter(l => l.riskLevel === 'critical' || l.riskLevel === 'high').length;

  const { mostActiveUser, mostCommonAction } = useMemo(() => {
    const byUser = new Map<string, number>();
    const byAction = new Map<string, number>();
    for (const log of auditLogs) {
      byUser.set(log.userName, (byUser.get(log.userName) ?? 0) + 1);
      byAction.set(log.action, (byAction.get(log.action) ?? 0) + 1);
    }
    const topOf = (map: Map<string, number>) =>
      [...map.entries()].sort((a, b) => b[1] - a[1])[0];
    const topUser = topOf(byUser);
    const topAction = topOf(byAction);
    return {
      mostActiveUser: topUser ? `${topUser[0]} (${topUser[1]} action${topUser[1] === 1 ? '' : 's'})` : '—',
      mostCommonAction: topAction ? topAction[0] : '—',
    };
  }, [auditLogs]);

  const securityAlerts = auditLogs.filter(
    (l) =>
      l.status === 'failure' ||
      l.riskLevel === 'high' ||
      l.riskLevel === 'critical' ||
      /fail|denied|unauthor|invalid/i.test(l.action)
  );

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
          <h1 className="text-2xl font-bold text-theme-text-primary">Audit Trail</h1>
          <p className="text-sm text-theme-text-secondary mt-1">Activity logs and compliance tracking</p>
        </div>
      </div>

      {loadError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Total Activities</p>
              <p className="text-3xl font-bold text-theme-text-primary mt-2">{auditLogs.length}</p>
              <p className="text-xs text-theme-accent mt-2">Most recent entries</p>
            </div>
            <FileText className="w-12 h-12 text-blue-100" />
          </div>
        </div>
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Successful</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{successfulActions}</p>
              <p className="text-xs text-green-600 mt-2">
                {auditLogs.length > 0 ? `${((successfulActions / auditLogs.length) * 100).toFixed(1)}% success rate` : 'No activity'}
              </p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-100" />
          </div>
        </div>
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Failed</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{failedActions}</p>
              <p className="text-xs text-red-600 mt-2">Requires attention</p>
            </div>
            <XCircle className="w-12 h-12 text-red-100" />
          </div>
        </div>
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">High Risk</p>
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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-text-tertiary w-4 h-4" />
            <input
              type="text"
              placeholder="Search audit logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
            />
          </div>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7days">Last 7 Days</option>
            <option value="last30days">Last 30 Days</option>
          </select>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
          >
            <option value="all">All Actions</option>
            {actions.map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
            <option value="warning">Warning</option>
          </select>
          <select
            value={selectedRiskLevel}
            onChange={(e) => setSelectedRiskLevel(e.target.value)}
            className="px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
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
            className="px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
          >
            <option value="all">All Resources</option>
            {resourceTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <button
          onClick={exportLogs}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-theme-accent rounded-lg hover:bg-theme-accent-hover"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-theme-muted border-b border-theme-border">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Timestamp</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">User</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Action</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Resource</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Status</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Risk Level</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">IP Address</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-theme-text-secondary">
                    Loading audit logs…
                  </td>
                </tr>
              )}
              {!loading && filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-theme-text-secondary">
                    {auditLogs.length === 0 ? 'No audit activity recorded yet.' : 'No logs match the selected filters.'}
                  </td>
                </tr>
              )}
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-theme-muted">
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-theme-text-tertiary" />
                      <div>
                        <p className="text-sm text-theme-text-primary">{log.timestamp}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-theme-text-tertiary" />
                      <div>
                        <p className="text-sm font-medium text-theme-text-primary">{log.userName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-theme-text-primary">{log.action}</span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getResourceIcon(log.resourceType)}
                      <div>
                        <p className="text-sm text-theme-text-primary">{log.resource}</p>
                        <p className="text-xs text-theme-text-secondary">{log.resourceType}</p>
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
                    <span className="text-sm text-theme-text-primary">{log.ipAddress}</span>
                  </td>
                  <td className="px-4 sm:px-6 py-4 max-w-md">
                    <span className="text-sm text-theme-text-secondary break-all">{log.details || '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Activity Summary</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Most Active User</span>
              <span className="text-sm font-semibold text-theme-text-primary">{mostActiveUser}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Most Common Action</span>
              <span className="text-sm font-semibold text-theme-accent">{mostCommonAction}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">High Risk Activities</span>
              <span className="text-sm font-semibold text-orange-600">{criticalRisk}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Failed Attempts</span>
              <span className="text-sm font-semibold text-red-600">{failedActions}</span>
            </div>
          </div>
        </div>

        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Security Alerts</h3>
          <div className="space-y-4">
            {securityAlerts.length === 0 && (
              <p className="text-sm text-theme-text-secondary">No security alerts — all recent activity is normal.</p>
            )}
            {securityAlerts.slice(0, 5).map((log) => (
              <div key={log.id} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">{log.action}</p>
                  <p className="text-xs text-red-700">{log.userName} — {log.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
