'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Settings, Save, RotateCcw, Download, Upload, Bell, Shield, Database, Globe, Mail, Phone, MapPin, Building, Users, Calendar, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

interface Setting {
  id: string;
  category: string;
  name: string;
  description: string;
  value: string | boolean | number;
  type: 'text' | 'email' | 'phone' | 'number' | 'boolean' | 'select' | 'textarea';
  options?: string[];
}

const settings: Setting[] = [
  // General Settings
  {
    id: 'company-name',
    category: 'General',
    name: 'Company Name',
    description: 'Official company name for legal documents',
    value: 'TechCorp Solutions Inc.',
    type: 'text'
  },
  {
    id: 'company-email',
    category: 'General',
    name: 'Company Email',
    description: 'Primary contact email address',
    value: 'contact@techcorp.com',
    type: 'email'
  },
  {
    id: 'company-phone',
    category: 'General',
    name: 'Company Phone',
    description: 'Primary contact phone number',
    value: '+1 (555) 123-4567',
    type: 'phone'
  },
  {
    id: 'company-address',
    category: 'General',
    name: 'Company Address',
    description: 'Main office address',
    value: '123 Business Ave, Suite 100, New York, NY 10001',
    type: 'textarea'
  },
  {
    id: 'timezone',
    category: 'General',
    name: 'Default Timezone',
    description: 'System default timezone',
    value: 'UTC-5',
    type: 'select',
    options: ['UTC-12', 'UTC-11', 'UTC-10', 'UTC-9', 'UTC-8', 'UTC-7', 'UTC-6', 'UTC-5', 'UTC-4', 'UTC-3', 'UTC-2', 'UTC-1', 'UTC', 'UTC+1', 'UTC+2', 'UTC+3', 'UTC+4', 'UTC+5', 'UTC+6', 'UTC+7', 'UTC+8', 'UTC+9', 'UTC+10', 'UTC+11', 'UTC+12']
  },
  {
    id: 'date-format',
    category: 'General',
    name: 'Date Format',
    description: 'Default date display format',
    value: 'MM/DD/YYYY',
    type: 'select',
    options: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY']
  },
  {
    id: 'currency',
    category: 'General',
    name: 'Default Currency',
    description: 'Primary currency for financial operations',
    value: 'USD',
    type: 'select',
    options: ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'AED']
  },

  // Security Settings
  {
    id: 'session-timeout',
    category: 'Security',
    name: 'Session Timeout',
    description: 'User session duration in minutes',
    value: 30,
    type: 'number'
  },
  {
    id: 'password-policy',
    category: 'Security',
    name: 'Strong Password Policy',
    description: 'Enforce complex password requirements',
    value: true,
    type: 'boolean'
  },
  {
    id: 'two-factor-auth',
    category: 'Security',
    name: 'Two-Factor Authentication',
    description: 'Require 2FA for all users',
    value: false,
    type: 'boolean'
  },
  {
    id: 'failed-login-attempts',
    category: 'Security',
    name: 'Max Failed Login Attempts',
    description: 'Account lockout threshold',
    value: 5,
    type: 'number'
  },
  {
    id: 'ip-whitelist',
    category: 'Security',
    name: 'IP Whitelist',
    description: 'Restrict access to specific IP addresses',
    value: false,
    type: 'boolean'
  },

  // Notification Settings
  {
    id: 'email-notifications',
    category: 'Notifications',
    name: 'Email Notifications',
    description: 'Enable system email notifications',
    value: true,
    type: 'boolean'
  },
  {
    id: 'sms-notifications',
    category: 'Notifications',
    name: 'SMS Notifications',
    description: 'Enable SMS notifications for critical alerts',
    value: false,
    type: 'boolean'
  },
  {
    id: 'daily-reports',
    category: 'Notifications',
    name: 'Daily Summary Reports',
    description: 'Send daily activity summary',
    value: true,
    type: 'boolean'
  },
  {
    id: 'weekly-reports',
    category: 'Notifications',
    name: 'Weekly Analytics Reports',
    description: 'Send weekly performance reports',
    value: true,
    type: 'boolean'
  },

  // System Settings
  {
    id: 'maintenance-mode',
    category: 'System',
    name: 'Maintenance Mode',
    description: 'Temporarily disable user access',
    value: false,
    type: 'boolean'
  },
  {
    id: 'backup-frequency',
    category: 'System',
    name: 'Backup Frequency',
    description: 'Automated backup schedule',
    value: 'daily',
    type: 'select',
    options: ['hourly', 'daily', 'weekly', 'monthly']
  },
  {
    id: 'log-retention',
    category: 'System',
    name: 'Log Retention Days',
    description: 'Number of days to retain system logs',
    value: 90,
    type: 'number'
  },
  {
    id: 'max-upload-size',
    category: 'System',
    name: 'Max Upload Size (MB)',
    description: 'Maximum file upload size in megabytes',
    value: 10,
    type: 'number'
  }
];

export default function SettingsPage() {
  const { tenantSlug } = useTenantContext();
  const [settingsState, setSettingsState] = useState(settings);
  const [selectedCategory, setSelectedCategory] = useState('General');
  const [hasChanges, setHasChanges] = useState(false);

  const categories = [...new Set(settings.map(s => s.category))];

  const filteredSettings = settingsState.filter(setting => setting.category === selectedCategory);

  const updateSetting = (id: string, value: any) => {
    setSettingsState(prev => prev.map(setting => 
      setting.id === id ? { ...setting, value } : setting
    ));
    setHasChanges(true);
  };

  const saveSettings = () => {
    // Simulate API call
    console.log('Saving settings:', settingsState);
    setHasChanges(false);
    alert('Settings saved successfully!');
  };

  const resetSettings = () => {
    setSettingsState(settings);
    setHasChanges(false);
  };

  const exportSettings = () => {
    const dataStr = JSON.stringify(settingsState, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'settings.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const renderSettingInput = (setting: Setting) => {
    switch (setting.type) {
      case 'boolean':
        return (
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={setting.value as boolean}
              onChange={(e) => updateSetting(setting.id, e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        );
      case 'select':
        return (
          <select
            value={setting.value as string}
            onChange={(e) => updateSetting(setting.id, e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {setting.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      case 'textarea':
        return (
          <textarea
            value={setting.value as string}
            onChange={(e) => updateSetting(setting.id, e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={setting.value as number}
            onChange={(e) => updateSetting(setting.id, parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
      case 'email':
        return (
          <input
            type="email"
            value={setting.value as string}
            onChange={(e) => updateSetting(setting.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
      case 'phone':
        return (
          <input
            type="tel"
            value={setting.value as string}
            onChange={(e) => updateSetting(setting.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
      default:
        return (
          <input
            type="text"
            value={setting.value as string}
            onChange={(e) => updateSetting(setting.id, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'General': return <Building className="w-5 h-5" />;
      case 'Security': return <Shield className="w-5 h-5" />;
      case 'Notifications': return <Bell className="w-5 h-5" />;
      case 'System': return <Database className="w-5 h-5" />;
      default: return <Settings className="w-5 h-5" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-600 mt-1">System configuration and preferences</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {getCategoryIcon(category)}
              {category}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-600 bg-amber-100 rounded-full">
              <AlertCircle className="w-3 h-3" />
              Unsaved changes
            </span>
          )}
          <button
            onClick={exportSettings}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={resetSettings}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={saveSettings}
            disabled={!hasChanges}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">{selectedCategory} Settings</h2>
          <div className="space-y-6">
            {filteredSettings.map(setting => (
              <div key={setting.id} className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    {setting.name}
                  </label>
                  <p className="text-xs text-gray-500 mb-2">{setting.description}</p>
                  {renderSettingInput(setting)}
                </div>
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    {setting.type === 'boolean' ? (
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        setting.value ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        {setting.value ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        ) : (
                          <AlertCircle className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <Settings className="w-6 h-6 text-blue-600" />
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-2 capitalize">{setting.type}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Information</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">System Version</span>
              <span className="text-sm font-medium text-gray-900">v2.4.1</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last Updated</span>
              <span className="text-sm font-medium text-gray-900">March 15, 2024</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Database Version</span>
              <span className="text-sm font-medium text-gray-900">PostgreSQL 14.2</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">API Version</span>
              <span className="text-sm font-medium text-gray-900">v1.8.0</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Database className="w-4 h-4" />
              Backup Database
            </button>
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <RotateCcw className="w-4 h-4" />
              Clear Cache
            </button>
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <Users className="w-4 h-4" />
              Send Test Notification
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
