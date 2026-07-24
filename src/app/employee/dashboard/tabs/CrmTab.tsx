'use client';

import { useState, useEffect } from 'react';
import CRMDashboard, { type CrmViewMode } from '@/app/tenant-admin/sections/crm-dashboard';

interface EmployeeProfile {
  id: string; name: string; email: string; jobTitle: string; role: string;
  departmentId: string; employmentType: string; status: string;
  hireDate: string; salary: number; lastLogin: string;
  portalPermissions?: Record<string, boolean> | null;
  tenantSlug?: string;
}

const HOD_ROLES = ['hod', 'head_of_department'];
const ADMIN_ROLES = ['admin', 'administrator', 'hr', 'hr_admin', 'hr_manager'];

export function CrmTab({ profile }: { profile: EmployeeProfile }) {
  const tenantSlug = profile.tenantSlug || null;
  const [viewMode, setViewMode] = useState<CrmViewMode>('mine');

  const role = (profile.role || 'staff').toLowerCase();
  const isHOD = HOD_ROLES.includes(role);
  const isAdmin = ADMIN_ROLES.includes(role);

  useEffect(() => {
    if (isAdmin) setViewMode('all');
    else if (isHOD) setViewMode('team');
    else setViewMode('mine');
  }, [isAdmin, isHOD]);

  const availableModes: CrmViewMode[] = isAdmin
    ? ['mine', 'team', 'all']
    : isHOD
    ? ['mine', 'team']
    : ['mine'];

  if (!tenantSlug) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-gray-500">Loading CRM...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {availableModes.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">View:</span>
          <div className="flex bg-gray-100 border border-gray-200 rounded-lg overflow-hidden">
            {availableModes.map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === mode ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                {mode === 'mine' ? 'My Data' : mode === 'team' ? 'Team' : 'All'}
              </button>
            ))}
          </div>
        </div>
      )}
      <CRMDashboard tenantSlug={tenantSlug} viewMode={viewMode} onViewModeChange={setViewMode} />
    </div>
  );
}
