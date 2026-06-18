'use client';

import React from 'react';
import {
  VendorsHeader,
  VendorsActions,
  VendorsFilters,
  VendorGrid,
  VendorAnalytics,
  Alert,
  type Vendor,
  type AlertMessage
} from './index';

interface VendorsModuleProps {
  tenantSlug: string;
  initialVendors?: Vendor[];
}

export const VendorsModule: React.FC<VendorsModuleProps> = ({
  tenantSlug,
  initialVendors = [
    { name: 'Tech Solutions Inc', category: 'Technology', status: 'Active', rating: 4.8, spend: '$125,000' },
    { name: 'Office Supply Co', category: 'Office Supplies', status: 'Active', rating: 4.2, spend: '$45,678' }
  ]
}) => {
  const [vendors] = React.useState<Vendor[]>(initialVendors);
  const [categoryFilter, setCategoryFilter] = React.useState('All');
  const [statusFilter, setStatusFilter] = React.useState('All');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [alert, setAlert] = React.useState<AlertMessage | null>(null);

  const categories = Array.from(new Set(vendors.map(v => v.category)));

  const filteredVendors = vendors.filter(v => {
    if (categoryFilter !== 'All' && v.category !== categoryFilter) return false;
    if (statusFilter !== 'All' && v.status !== statusFilter) return false;
    if (searchQuery && !v.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const showAlert = (type: AlertMessage['type'], message: string) => {
    setAlert({ type, message });
  };

  return (
    <div className="p-6">
      <VendorsHeader totalVendors={vendors.length} />
      
      <VendorsActions
        onAddVendor={() => showAlert('info', 'Add Vendor modal')}
        onExport={() => showAlert('success', 'Vendors exported!')}
      />
      
      <VendorsFilters
        statusFilter={statusFilter}
        categoryFilter={categoryFilter}
        searchQuery={searchQuery}
        categories={categories}
        onStatusChange={setStatusFilter}
        onCategoryChange={setCategoryFilter}
        onSearchChange={setSearchQuery}
      />
      
      <VendorGrid
        vendors={filteredVendors}
        onView={(vendor) => showAlert('info', `Viewing ${vendor.name}`)}
        onEdit={(vendor) => showAlert('info', `Editing ${vendor.name}`)}
      />
      
      <VendorAnalytics />
      
      <Alert alert={alert} onClose={() => setAlert(null)} />
    </div>
  );
};

export default VendorsModule;
