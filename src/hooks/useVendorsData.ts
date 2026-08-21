/**
 * useVendorsData Hook
 * Custom hook to connect Vendors components to real API data
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchVendors, createVendor } from "@/lib/api-services";
import { Vendor } from "@/components/modules";

interface UseVendorsDataOptions {
  tenantSlug: string;
  initialPage?: number;
  pageSize?: number;
}

export function useVendorsData({
  tenantSlug,
  initialPage = 1,
  pageSize = 50,
}: UseVendorsDataOptions) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<{
    status?: string;
    category?: string;
    search?: string;
  }>({});

  // Fetch vendors
  const loadVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchVendors(tenantSlug, filters, {
        page,
        limit: pageSize,
      });
      setVendors(result.vendors || result.data || []);
      setTotal(result.pagination?.total || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load vendors";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, filters, page, pageSize]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  const handleCreateVendor = useCallback(
    async (data: Partial<Vendor>) => {
      try {
        await createVendor(tenantSlug, data);
        await loadVendors();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create vendor";
        setError(message);
        return false;
      }
    },
    [tenantSlug, loadVendors]
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
    vendors,
    loading,
    error,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    filters,
    setFilters: handleSetFilters,
    createVendor: handleCreateVendor,
    nextPage: handleNextPage,
    previousPage: handlePreviousPage,
    hasNextPage: page * pageSize < total,
    hasPreviousPage: page > 1,
    refetch: loadVendors,
  };
}
