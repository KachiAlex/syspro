'use client';

import React from 'react';
import { Alert } from './components/Alert';
import { POHeader } from './components/POHeader';
import { POActions } from './components/POActions';
import { POTable } from './components/POTable';
import type { PurchaseOrder, AlertMessage } from './types/index';

interface PurchaseOrdersModuleProps {
  tenantSlug: string;
  initialPOs?: PurchaseOrder[];
}

export const PurchaseOrdersModule: React.FC<PurchaseOrdersModuleProps> = ({
  tenantSlug,
  initialPOs = []
}) => {
  const [purchaseOrders] = React.useState<PurchaseOrder[]>(initialPOs);
  const [alert, setAlert] = React.useState<AlertMessage | null>(null);

  const showAlert = (type: AlertMessage['type'], message: string) => {
    setAlert({ type, message });
  };

  return (
    <div className="p-6">
      <POHeader totalPOs={purchaseOrders.length} />
      
      <POActions
        onCreate={() => showAlert('info', 'Create PO dialog')}
        onExport={() => showAlert('success', 'POs exported successfully!')}
        onSendNotification={() => showAlert('success', 'Notifications sent to vendors!')}
      />
      
      <POTable
        purchaseOrders={purchaseOrders}
        onView={(po) => showAlert('info', `Viewing ${po.poNumber}`)}
        onEdit={(po) => showAlert('info', `Editing ${po.poNumber}`)}
        onDownload={(po) => showAlert('success', `Downloaded ${po.poNumber}`)}
        onDelete={(po) => showAlert('error', `Deleted ${po.poNumber}`)}
      />
      
      <Alert alert={alert} onClose={() => setAlert(null)} />
    </div>
  );
};

export default PurchaseOrdersModule;
