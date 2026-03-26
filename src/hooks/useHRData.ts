/**
 * useHRData Hook
 * Custom hook to connect HR components to real API data
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchEmployees,
  createEmployee,
  updateEmployee,
  fetchDepartments,
} from "@/lib/api-services";
import { Employee } from "@/components/modules";

interface UseHRDataOptions {
  tenantSlug: string;
  initialPage?: number;
  pageSize?: number;
}

export function useHRData({
  tenantSlug,
  initialPage = 1,
  pageSize = 50,
}: UseHRDataOptions) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<{
    department?: string;
    status?: string;
    search?: string;
  }>({});

  // Fetch employees
  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchEmployees(tenantSlug, filters, {
        page,
        limit: pageSize,
      });
      setEmployees(result.data || []);
      setTotal(result.pagination?.total || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load employees";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, filters, page, pageSize]);

  // Fetch departments
  const loadDepartments = useCallback(async () => {
    try {
      const result = await fetchDepartments(tenantSlug);
      setDepartments(result.data || []);
    } catch (err) {
      console.error("Failed to load departments:", err);
    }
  }, [tenantSlug]);

  // Initial load
  useEffect(() => {
    loadEmployees();
    loadDepartments();
  }, [loadEmployees, loadDepartments]);

  // Create employee
  const handleCreateEmployee = useCallback(
    async (data: Partial<Employee>) => {
      try {
        await createEmployee(tenantSlug, data);
        await loadEmployees(); // Refresh list
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create employee";
        setError(message);
        return false;
      }
    },
    [tenantSlug, loadEmployees]
  );

  // Update employee
  const handleUpdateEmployee = useCallback(
    async (employeeId: string, updates: Partial<Employee>) => {
      try {
        await updateEmployee(tenantSlug, employeeId, updates);
        await loadEmployees(); // Refresh list
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update employee";
        setError(message);
        return false;
      }
    },
    [tenantSlug, loadEmployees]
  );

  // Update filters
  const handleSetFilters = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page
  }, []);

  // Handle pagination
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
    employees,
    departments,
    loading,
    error,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    filters,
    setFilters: handleSetFilters,
    createEmployee: handleCreateEmployee,
    updateEmployee: handleUpdateEmployee,
    nextPage: handleNextPage,
    previousPage: handlePreviousPage,
    hasNextPage: page * pageSize < total,
    hasPreviousPage: page > 1,
    refetch: loadEmployees,
  };
}
