/**
 * useBillsData Hook
 * Custom hook to connect Bills components to real API data
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchBills, createBill, processPayment } from "@/lib/api-services";
import { Bill } from "@/components/modules";

interface UseBillsDataOptions {
  tenantSlug: string;
  initialPage?: number;
  pageSize?: number;
}

export function useBillsData({
  tenantSlug,
  initialPage = 1,
  pageSize = 50,
}: UseBillsDataOptions) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<{
    status?: string;
    vendor?: string;
    search?: string;
  }>({});

  // Fetch bills
  const loadBills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchBills(tenantSlug, filters, {
        page,
        limit: pageSize,
      });
      setBills(result.data || []);
      setTotal(result.pagination?.total || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load bills";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, filters, page, pageSize]);

  // Initial load
  useEffect(() => {
    loadBills();
  }, [loadBills]);

  // Create bill
  const handleCreateBill = useCallback(
    async (data: Partial<Bill>) => {
      try {
        await createBill(tenantSlug, data);
        await loadBills();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create bill";
        setError(message);
        return false;
      }
    },
    [tenantSlug, loadBills]
  );

  // Process payment
  const handlePayment = useCallback(
    async (billId: string, amount: number) => {
      try {
        await processPayment(tenantSlug, billId, amount);
        await loadBills();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to process payment";
        setError(message);
        return false;
      }
    },
    [tenantSlug, loadBills]
  );

  // Update filters
  const handleSetFilters = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  // Pagination
  const handleNextPage = useCallback(() => {
    if (page * pageSize < total) {
      setPage((p) => p + 1);
    }
  }, [page, pageSize, total]);

  const handlePreviousPage = useCallback(() => {
    if (page > 1) {
      setPage((p) => p - 1);
    }
  }, [page]);

  return {
    bills,
    loading,
    error,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    filters,
    setFilters: handleSetFilters,
    createBill: handleCreateBill,
    processPayment: handlePayment,
    nextPage: handleNextPage,
    previousPage: handlePreviousPage,
    hasNextPage: page * pageSize < total,
    hasPreviousPage: page > 1,
    refetch: loadBills,
  };
}
