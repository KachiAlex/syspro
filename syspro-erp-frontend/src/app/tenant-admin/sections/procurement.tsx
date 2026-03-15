'use client';

import React, { useState } from 'react';
import { Plus, Package, Eye, Edit, Download, Building, Target, Calculator, Filter, TrendingUp } from 'lucide-react';

interface Procurement {
  tenantSlug: string;
}

const ProcurementComponent: React.FC<Procurement> = ({ tenantSlug }) => {
  const [requisitions] = useState([
    { id: 'REQ-2024-001', requester: 'Alex Johnson', department: 'IT', items: 3, value: '$12,450', status: 'Pending Approval' },
    { id: 'REQ-2024-002', requester: 'Sarah Williams', department: 'Marketing', items: 5, value: '$8,750', status: 'Approved' }
  ]);

  const [alert, setAlert] = useState<{ type: 'success' | 'info'; message: string } | null>(null);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Procurement Workspace</h2>
        <p className="text-gray-600">Manage purchase requisitions, vendor selection, and procurement workflows</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Requisitions</p>
              <p className="text-xl font-bold text-gray-900">{requisitions.length}</p>
            </div>
            <Package className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Approval</p>
              <p className="text-xl font-bold text-gray-900">45</p>
            </div>
            <Target className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">This Month Spend</p>
              <p className="text-xl font-bold text-gray-900">$89,234</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Vendors</p>
              <p className="text-xl font-bold text-gray-900">167</p>
            </div>
            <Building className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2 inline" />
            New Requisition
          </button>
          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            <Package className="w-4 h-4 mr-2 inline" />
            Create PO
          </button>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            <Building className="w-4 h-4 mr-2 inline" />
            Find Vendors
          </button>
          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4 mr-2 inline" />
            Export Reports
          </button>
        </div>
      </div>

      {/* Requisitions Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Purchase Requisitions</h3>
          <button className="text-blue-600 hover:text-blue-800 text-sm">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requisition ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requester</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {requisitions.map((req, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{req.id}</td>
                  <td className="px-4 py-3">{req.requester}</td>
                  <td className="px-4 py-3">{req.department}</td>
                  <td className="px-4 py-3">{req.items}</td>
                  <td className="px-4 py-3 font-semibold">{req.value}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      req.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>{req.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="text-blue-600"><Eye className="w-4 h-4" /></button>
                      <button className="text-green-600"><Edit className="w-4 h-4" /></button>
                      <button className="text-purple-600"><Package className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Workflow & Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Approvals</h3>
          <div className="space-y-3">
            {[
              { id: 'REQ-2024-001', priority: 'High', value: '$12,450', submitted: '2 days ago' },
              { id: 'REQ-2024-003', priority: 'High', value: '$23,450', submitted: '3 days ago' }
            ].map((a, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      a.priority === 'High' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                    }`}>{a.priority}</span>
                    <h4 className="font-medium">{a.id}</h4>
                  </div>
                  <p className="text-xs text-gray-500">{a.value} • Submitted: {a.submitted}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setAlert({ type: 'success', message: 'Approved!' })} className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">Approve</button>
                  <button className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending by Department</h3>
          <div className="space-y-3">
            {[
              { dept: 'IT', spend: '$45,678', pct: 35 },
              { dept: 'Operations', spend: '$32,450', pct: 25 },
              { dept: 'Marketing', spend: '$23,234', pct: 18 },
              { dept: 'HR', spend: '$15,678', pct: 12 }
            ].map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm font-medium w-24">{d.dept}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div className="h-2 rounded-full bg-blue-500" style={{ width: `${d.pct}%` }}></div>
                </div>
                <span className="text-sm font-semibold w-20 text-right">{d.spend}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900">4.2 days</p>
          <p className="text-sm text-gray-600">Avg. Approval Time</p>
        </div>
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900">87%</p>
          <p className="text-sm text-gray-600">On-Time Delivery</p>
        </div>
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900">$2,450</p>
          <p className="text-sm text-gray-600">Avg. Order Value</p>
        </div>
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900">94%</p>
          <p className="text-sm text-gray-600">Budget Compliance</p>
        </div>
      </div>

      {alert && (
        <div className="fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white font-medium bg-green-600">
          {alert.message}
        </div>
      )}
    </div>
  );
};

export default ProcurementComponent;
