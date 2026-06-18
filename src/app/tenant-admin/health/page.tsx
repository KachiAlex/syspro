'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Heart, Server, Database, Wifi, HardDrive, Cpu, Thermometer, AlertTriangle, CheckCircle, XCircle, Clock, TrendingUp, TrendingDown, Activity, Zap, Shield, RefreshCw, Download, Eye } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

interface SystemMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  threshold: {
    warning: number;
    critical: number;
  };
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
}

interface Service {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error' | 'maintenance';
  uptime: number;
  cpu: number;
  memory: number;
  lastRestart: string;
  dependencies: string[];
  healthChecks: {
    name: string;
    status: 'pass' | 'fail';
    responseTime: number;
  }[];
}

interface Alert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: string;
  service: string;
  resolved: boolean;
}

const systemMetrics: SystemMetric[] = [
  {
    id: '1',
    name: 'CPU Usage',
    value: 45.2,
    unit: '%',
    status: 'healthy',
    threshold: { warning: 70, critical: 90 },
    trend: 'stable',
    lastUpdated: '2024-04-03 14:30:00'
  },
  {
    id: '2',
    name: 'Memory Usage',
    value: 68.7,
    unit: '%',
    status: 'warning',
    threshold: { warning: 65, critical: 85 },
    trend: 'up',
    lastUpdated: '2024-04-03 14:30:00'
  },
  {
    id: '3',
    name: 'Disk Usage',
    value: 34.8,
    unit: '%',
    status: 'healthy',
    threshold: { warning: 80, critical: 95 },
    trend: 'stable',
    lastUpdated: '2024-04-03 14:30:00'
  },
  {
    id: '4',
    name: 'Network Latency',
    value: 12.4,
    unit: 'ms',
    status: 'healthy',
    threshold: { warning: 50, critical: 100 },
    trend: 'down',
    lastUpdated: '2024-04-03 14:30:00'
  },
  {
    id: '5',
    name: 'Database Connections',
    value: 127,
    unit: 'connections',
    status: 'healthy',
    threshold: { warning: 180, critical: 200 },
    trend: 'stable',
    lastUpdated: '2024-04-03 14:30:00'
  },
  {
    id: '6',
    name: 'API Response Time',
    value: 245,
    unit: 'ms',
    status: 'warning',
    threshold: { warning: 200, critical: 500 },
    trend: 'up',
    lastUpdated: '2024-04-03 14:30:00'
  }
];

const services: Service[] = [
  {
    id: '1',
    name: 'Web Server',
    status: 'running',
    uptime: 99.98,
    cpu: 23.4,
    memory: 45.2,
    lastRestart: '2024-03-15 08:30:00',
    dependencies: ['Database', 'Cache'],
    healthChecks: [
      { name: 'HTTP Endpoint', status: 'pass', responseTime: 124 },
      { name: 'SSL Certificate', status: 'pass', responseTime: 45 },
      { name: 'Load Balancer', status: 'pass', responseTime: 67 }
    ]
  },
  {
    id: '2',
    name: 'Database Server',
    status: 'running',
    uptime: 99.95,
    cpu: 67.8,
    memory: 72.3,
    lastRestart: '2024-03-10 02:15:00',
    dependencies: ['Storage'],
    healthChecks: [
      { name: 'Connection Pool', status: 'pass', responseTime: 89 },
      { name: 'Query Performance', status: 'pass', responseTime: 156 },
      { name: 'Backup Status', status: 'pass', responseTime: 234 }
    ]
  },
  {
    id: '3',
    name: 'API Gateway',
    status: 'running',
    uptime: 99.92,
    cpu: 34.6,
    memory: 56.7,
    lastRestart: '2024-03-20 14:20:00',
    dependencies: ['Web Server', 'Database'],
    healthChecks: [
      { name: 'Rate Limiting', status: 'pass', responseTime: 12 },
      { name: 'Authentication', status: 'pass', responseTime: 78 },
      { name: 'Request Routing', status: 'fail', responseTime: 1023 }
    ]
  },
  {
    id: '4',
    name: 'Cache Server',
    status: 'error',
    uptime: 98.76,
    cpu: 89.2,
    memory: 91.4,
    lastRestart: '2024-04-03 12:45:00',
    dependencies: [],
    healthChecks: [
      { name: 'Memory Usage', status: 'fail', responseTime: 1456 },
      { name: 'Cache Hit Rate', status: 'fail', responseTime: 892 },
      { name: 'Replication Status', status: 'pass', responseTime: 234 }
    ]
  },
  {
    id: '5',
    name: 'Email Service',
    status: 'maintenance',
    uptime: 99.89,
    cpu: 12.3,
    memory: 28.9,
    lastRestart: '2024-04-01 09:00:00',
    dependencies: ['Database'],
    healthChecks: [
      { name: 'SMTP Connection', status: 'pass', responseTime: 234 },
      { name: 'Queue Processing', status: 'pass', responseTime: 456 },
      { name: 'Template Engine', status: 'pass', responseTime: 123 }
    ]
  }
];

const alerts: Alert[] = [
  {
    id: '1',
    severity: 'critical',
    title: 'Cache Server Memory Critical',
    description: 'Cache server memory usage exceeded 90%',
    timestamp: '2024-04-03 13:45:00',
    service: 'Cache Server',
    resolved: false
  },
  {
    id: '2',
    severity: 'high',
    title: 'API Gateway Response Time',
    description: 'Request routing health check failing',
    timestamp: '2024-04-03 13:30:00',
    service: 'API Gateway',
    resolved: false
  },
  {
    id: '3',
    severity: 'medium',
    title: 'Memory Usage Warning',
    description: 'System memory usage above 65%',
    timestamp: '2024-04-03 13:15:00',
    service: 'System',
    resolved: false
  },
  {
    id: '4',
    severity: 'low',
    title: 'Scheduled Maintenance',
    description: 'Email service under maintenance',
    timestamp: '2024-04-03 12:00:00',
    service: 'Email Service',
    resolved: true
  }
];

export default function HealthPage() {
  const { tenantSlug } = useTenantContext();
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const getMetricStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-amber-600 bg-amber-100';
      case 'critical': return 'text-red-600 bg-red-100';
      case 'offline': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getMetricStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'critical': return <XCircle className="w-4 h-4" />;
      case 'offline': return <XCircle className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getServiceStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-600 bg-green-100';
      case 'stopped': return 'text-red-600 bg-red-100';
      case 'error': return 'text-red-600 bg-red-100';
      case 'maintenance': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'medium': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-900 border-gray-200';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-3 h-3 text-red-500" />;
      case 'down': return <TrendingDown className="w-3 h-3 text-green-500" />;
      case 'stable': return <Activity className="w-3 h-3 text-blue-500" />;
      default: return <Activity className="w-3 h-3 text-gray-500" />;
    }
  };

  const healthyServices = services.filter(s => s.status === 'running').length;
  const totalAlerts = alerts.filter(a => !a.resolved).length;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.resolved).length;
  const avgUptime = services.reduce((sum, s) => sum + s.uptime, 0) / services.length;

  const exportHealthReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      metrics: systemMetrics,
      services: services,
      alerts: alerts.filter(a => !a.resolved)
    };
    
    const dataStr = JSON.stringify(report, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'health_report.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F8FAFC]">System Health</h1>
          <p className="text-sm text-gray-600 mt-1">System monitoring and diagnostics</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="5m">Last 5 minutes</option>
            <option value="15m">Last 15 minutes</option>
            <option value="1h">Last hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Auto-refresh
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={exportHealthReport}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">System Status</p>
              <p className="text-3xl font-bold text-green-600 mt-2">Healthy</p>
              <p className="text-xs text-green-600 mt-2">All systems operational</p>
            </div>
            <Heart className="w-12 h-12 text-green-100" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Services</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{healthyServices}/{services.length}</p>
              <p className="text-xs text-blue-600 mt-2">{((healthyServices / services.length) * 100).toFixed(1)}% uptime</p>
            </div>
            <Server className="w-12 h-12 text-blue-100" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Alerts</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">{totalAlerts}</p>
              <p className="text-xs text-amber-600 mt-2">{criticalAlerts} critical</p>
            </div>
            <AlertTriangle className="w-12 h-12 text-amber-100" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Uptime</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">{avgUptime.toFixed(2)}%</p>
              <p className="text-xs text-purple-600 mt-2">Last 30 days</p>
            </div>
            <Activity className="w-12 h-12 text-purple-100" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Metrics</h3>
          <div className="space-y-4">
            {systemMetrics.map((metric) => (
              <div key={metric.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`p-2 rounded-lg ${getMetricStatusColor(metric.status)}`}>
                    {getMetricStatusIcon(metric.status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">{metric.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">
                          {metric.value}{metric.unit}
                        </span>
                        {getTrendIcon(metric.trend)}
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            metric.status === 'healthy' ? 'bg-green-500' :
                            metric.status === 'warning' ? 'bg-amber-500' :
                            metric.status === 'critical' ? 'bg-red-500' : 'bg-gray-500'
                          }`}
                          style={{ 
                            width: `${Math.min((metric.value / metric.threshold.critical) * 100, 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Warning: {metric.threshold.warning}{metric.unit} | Critical: {metric.threshold.critical}{metric.unit}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Status</h3>
          <div className="space-y-4">
            {services.map((service) => (
              <div key={service.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getServiceStatusColor(service.status)}`}>
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{service.name}</p>
                      <p className="text-xs text-gray-500">Uptime: {service.uptime}%</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getServiceStatusColor(service.status)}`}>
                    {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-600">CPU: {service.cpu}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-600">Memory: {service.memory}%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-900">Health Checks:</p>
                  <div className="space-y-1">
                    {service.healthChecks.map((check, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">{check.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{check.responseTime}ms</span>
                          <div className={`w-2 h-2 rounded-full ${
                            check.status === 'pass' ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Alerts</h3>
          <div className="space-y-3">
            {alerts.filter(alert => !alert.resolved).map((alert) => (
              <div key={alert.id} className={`border rounded-lg p-4 ${getAlertSeverityColor(alert.severity)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      <h4 className="text-sm font-medium">{alert.title}</h4>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getAlertSeverityColor(alert.severity)}`}>
                        {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{alert.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Service: {alert.service}</span>
                      <span>{alert.timestamp}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-sm font-medium hover:underline">
                      View Details
                    </button>
                    <button className="text-sm font-medium hover:underline">
                      Resolve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
