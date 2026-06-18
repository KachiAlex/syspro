'use client';

import { useState } from 'react';
import { Bill, AlertMessage } from '../types';

export const useBillsState = (initialBills: Bill[]) => {
  const [bills, setBills] = useState<Bill[]>(initialBills);
  const [statusFilter, setStatusFilter] = useState('All');
  const [vendorFilter, setVendorFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [alert, setAlert] = useState<AlertMessage | null>(null);

  const filteredBills = bills.filter(bill => {
    if (statusFilter !== 'All' && bill.status !== statusFilter) return false;
    if (vendorFilter !== 'All' && bill.vendor !== vendorFilter) return false;
    if (searchQuery && !bill.id.includes(searchQuery)) return false;
    return true;
  });

  const addBill = (newBill: Bill) => {
    setBills([...bills, newBill]);
    setAlert({ type: 'success', message: 'Bill added successfully!' });
  };

  const showAlert = (type: AlertMessage['type'], message: string) => {
    setAlert({ type, message });
  };

  return {
    bills,
    setBills,
    statusFilter,
    setStatusFilter,
    vendorFilter,
    setVendorFilter,
    searchQuery,
    setSearchQuery,
    alert,
    setAlert,
    filteredBills,
    addBill,
    showAlert
  };
};
