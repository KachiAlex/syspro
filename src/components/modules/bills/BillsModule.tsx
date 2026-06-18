'use client';

import React from 'react';
import {
  BillsHeader,
  BillsQuickActions,
  BillsFilters,
  BillsTable,
  AgingAnalysis,
  Alert,
  useBillsState,
  type Bill
} from './index';
import { useBillsData } from '@/hooks/useBillsData';
import { AddBillModal, MakePaymentModal, SchedulePaymentModal } from '@/app/tenant-admin/sections/bills-modals';

interface BillsModuleProps {
  tenantSlug: string;
  initialBills?: Bill[];
}

export const BillsModule: React.FC<BillsModuleProps> = ({
  tenantSlug,
  initialBills = [
    { id: 'BILL-2024-045', vendor: 'Tech Solutions Inc', amount: '$12,450.00', dueDate: '2024-03-15', status: 'Unpaid' },
    { id: 'BILL-2024-044', vendor: 'Office Supply Co', amount: '$3,750.00', dueDate: '2024-03-10', status: 'Partially Paid' }
  ]
}) => {
  // Use the new API hook for real data
  const {
    bills,
    loading: dataLoading,
    error: dataError,
    createBill: createBillAPI,
    processPayment: processPaymentAPI,
    filters,
    setFilters,
    refetch: refetchBills,
  } = useBillsData({ tenantSlug });

  // Keep local state for UI filters and search
  const [statusFilter, setStatusFilter] = React.useState('');
  const [vendorFilter, setVendorFilter] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [alert, setAlert] = React.useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Update API filters when local filters change
  React.useEffect(() => {
    setFilters({
      status: statusFilter || undefined,
      vendor: vendorFilter || undefined,
      search: searchQuery || undefined,
    });
  }, [statusFilter, vendorFilter, searchQuery, setFilters]);

  // Filter bills locally for display
  const filteredBills = React.useMemo(() => {
    return bills.filter(bill => {
      const matchStatus = !statusFilter || bill.status === statusFilter;
      const matchVendor = !vendorFilter || bill.vendor === vendorFilter;
      const matchSearch = !searchQuery ||
        bill.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bill.vendor?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchVendor && matchSearch;
    });
  }, [bills, statusFilter, vendorFilter, searchQuery]);

  const showAlert = (type: 'success' | 'error' | 'info', message: string) => {
    setAlert({ type, message });
  };

  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showPaymentModal, setShowPaymentModal] = React.useState(false);
  const [showScheduleModal, setShowScheduleModal] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const vendors = Array.from(new Set(bills.map(b => b.vendor)));

  const handleAddBill = async (data: any) => {
    setIsSubmitting(true);
    try {
      const success = await createBillAPI({
        id: data.billNumber || `BILL-${Date.now()}`,
        vendor: data.vendor,
        amount: `$${parseFloat(data.amount).toLocaleString('en-US', {minimumFractionDigits: 2})}`,
        dueDate: data.dueDate,
        status: 'Draft'
      });
      
      if (success) {
        showAlert('success', 'Bill added successfully!');
        setShowAddModal(false);
      } else {
        showAlert('error', 'Failed to add bill');
      }
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to add bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMakePayment = async (data: any) => {
    setIsSubmitting(true);
    try {
      const amount = parseFloat(data.amount);
      const success = await processPaymentAPI(data.billId || data.billNumber, amount);
      
      if (success) {
        showAlert('success', 'Payment processed successfully!');
        setShowPaymentModal(false);
      } else {
        showAlert('error', 'Failed to process payment');
      }
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to process payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSchedulePayment = async (data: any) => {
    setIsSubmitting(true);
    try {
      // Schedule payment - for now just show success
      // In a real scenario, this would call an API endpoint
      showAlert('success', 'Payment scheduled successfully!');
      setShowScheduleModal(false);
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to schedule payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = async () => {
    const csvContent = [
      ['Bill #', 'Vendor', 'Amount', 'Due Date', 'Status'],
      ...filteredBills.map(b => [b.id, b.vendor, b.amount, b.dueDate, b.status])
    ].map(row => row.join(',')).join('\n');

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bills-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showAlert('success', 'Export completed!');
  };

  return (
    <div className="p-6">
      <BillsHeader
        totalBills={bills.length}
        totalOutstanding="$89,234"
        totalOverdue="$12,450"
        dueThisWeek="$23,567"
      />
      
      <BillsQuickActions
        onAddBill={() => setShowAddModal(true)}
        onMakePayment={() => setShowPaymentModal(true)}
        onSchedulePayment={() => setShowScheduleModal(true)}
        onExport={handleExport}
      />
      
      <BillsFilters
        statusFilter={statusFilter}
        vendorFilter={vendorFilter}
        searchQuery={searchQuery}
        vendors={vendors}
        onStatusChange={setStatusFilter}
        onVendorChange={setVendorFilter}
        onSearchChange={setSearchQuery}
      />
      
      <BillsTable
        bills={filteredBills}
        onView={(bill) => showAlert('info', `Viewing ${bill.id}`)}
        onEdit={(bill) => showAlert('info', `Editing ${bill.id}`)}
        onPayment={(bill) => {
          showAlert('info', `Payment for ${bill.id}`);
          setShowPaymentModal(true);
        }}
        onDownload={(bill) => showAlert('info', `Downloaded ${bill.id}`)}
      />
      
      <AgingAnalysis />
      
      {/* Modals */}
      <AddBillModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddBill}
      />
      <MakePaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSubmit={handleMakePayment}
      />
      <SchedulePaymentModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSubmit={handleSchedulePayment}
      />
      
      <Alert alert={alert} onClose={() => setAlert(null)} />
    </div>
  );
};

export default BillsModule;
