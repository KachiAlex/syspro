'use client';

import React from 'react';
import { Alert } from './components/Alert';
import { InvoicesHeader } from './components/InvoicesHeader';
import { InvoicesActions } from './components/InvoicesActions';
import { InvoicesTable } from './components/InvoicesTable';
import type { Invoice, AlertMessage } from './types/invoices';

interface InvoicesModuleProps {
  tenantSlug: string;
  initialInvoices?: Invoice[];
}

export const InvoicesModule: React.FC<InvoicesModuleProps> = ({
  tenantSlug,
  initialInvoices = [
    { id: 'INV-001', billId: 'BILL-001', customer: 'Tech Solutions Inc', amount: '$12,450', status: 'Sent', issueDate: '2024-03-10', dueDate: '2024-04-10' },
    { id: 'INV-002', billId: 'BILL-002', customer: 'Office Supply Co', amount: '$3,750', status: 'Draft', issueDate: '2024-03-09', dueDate: '2024-04-09' }
  ]
}) => {
  const [invoices] = React.useState<Invoice[]>(initialInvoices);
  const [alert, setAlert] = React.useState<AlertMessage | null>(null);

  const showAlert = (type: AlertMessage['type'], message: string) => {
    setAlert({ type, message });
  };

  return (
    <div className="p-6">
      <InvoicesHeader totalInvoices={invoices.length} />
      
      <InvoicesActions
        onCreateInvoice={() => showAlert('info', 'Create Invoice dialog')}
        onSendInvoice={() => showAlert('success', 'Invoice sent to customer!')}
        onExport={() => showAlert('success', 'Invoices exported successfully!')}
      />
      
      <InvoicesTable
        invoices={invoices}
        onView={(invoice) => showAlert('info', `Viewing ${invoice.id}`)}
        onSend={(invoice) => showAlert('success', `Sent ${invoice.id}`)}
        onDownload={(invoice) => showAlert('success', `Downloaded ${invoice.id}`)}
        onDelete={(invoice) => showAlert('error', `Deleted ${invoice.id}`)}
      />
      
      <Alert alert={alert} onClose={() => setAlert(null)} />
    </div>
  );
};

export default InvoicesModule;
