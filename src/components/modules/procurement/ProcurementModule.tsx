'use client';

import React from 'react';
import {
  ProcurementHeader,
  ProcurementActions,
  RequisitionsTable,
  ProcurementAnalytics,
  MetricsGrid,
  Alert,
  type Requisition,
  type AlertMessage
} from './index';

interface ProcurementModuleProps {
  tenantSlug: string;
  initialRequisitions?: Requisition[];
}

export const ProcurementModule: React.FC<ProcurementModuleProps> = ({
  tenantSlug,
  initialRequisitions = [
    { id: 'REQ-2024-001', requester: 'Alex Johnson', department: 'IT', items: 3, value: '$12,450', status: 'Pending Approval' },
    { id: 'REQ-2024-002', requester: 'Sarah Williams', department: 'Marketing', items: 5, value: '$8,750', status: 'Approved' }
  ]
}) => {
  const [requisitions] = React.useState<Requisition[]>(initialRequisitions);
  const [alert, setAlert] = React.useState<AlertMessage | null>(null);

  const showAlert = (type: AlertMessage['type'], message: string) => {
    setAlert({ type, message });
  };

  return (
    <div className="p-6">
      <ProcurementHeader totalRequisitions={requisitions.length} />
      
      <ProcurementActions
        onNewRequisition={() => showAlert('info', 'New Requisition modal')}
        onCreatePO={() => showAlert('info', 'Create PO modal')}
        onFindVendors={() => showAlert('info', 'Find Vendors modal')}
        onExportReports={() => showAlert('success', 'Reports exported!')}
      />
      
      <RequisitionsTable
        requisitions={requisitions}
        onView={(req) => showAlert('info', `Viewing ${req.id}`)}
        onEdit={(req) => showAlert('info', `Editing ${req.id}`)}
        onCreatePO={(req) => showAlert('success', `PO created from ${req.id}!`)}
      />
      
      <ProcurementAnalytics
        onApprove={(approval) => showAlert('success', `Approved ${approval.id}!`)}
        onReject={(approval) => showAlert('error', `Rejected ${approval.id}`)}
      />
      
      <MetricsGrid />
      
      <Alert alert={alert} onClose={() => setAlert(null)} />
    </div>
  );
};

export default ProcurementModule;
