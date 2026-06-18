/**
 * useProcurementData Hook
 * Custom hook to connect Procurement components to real API data
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchRequisitions, approveRequisition } from "@/lib/api-services";
import { Requisition } from "@/components/modules";

interface UseProcurementDataOptions {
  tenantSlug: string;
  initialPage?: number;
  pageSize?: number;
}

export function useProcurementData({
  tenantSlug,
  initialPage = 1,
  pageSize = 50,
}: UseProcurementDataOptions) {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<{
    status?: string;
    department?: string;
  }>({});

  // Fetch requisitions
  const loadRequisitions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRequisitions(tenantSlug, filters, {
        page,
        limit: pageSize,
      });
      setRequisitions(result.data || []);
      setTotal(result.pagination?.total || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load requisitions";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, filters, page, pageSize]);

  useEffect(() => {
    loadRequisitions();
  }, [loadRequisitions]);

  const handleApproveRequisition = useCallback(
    async (requisitionId: string) => {
      try {
        await approveRequisition(tenantSlug, requisitionId);
        await loadRequisitions();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to approve requisition";
        setError(message);
        return false;
      }
    },
    [tenantSlug, loadRequisitions]
  );

  const handleSetFilters = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

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
    requisitions,
    loading,
    error,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    filters,
    setFilters: handleSetFilters,
    approveRequisition: handleApproveRequisition,
    nextPage: handleNextPage,
    previousPage: handlePreviousPage,
    hasNextPage: page * pageSize < total,
    hasPreviousPage: page > 1,
    refetch: loadRequisitions,
  };
}
