/**
 * Tenant Admin React Hooks
 * Hooks for use in tenant-admin UI components
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  Department,
  Role,
  Employee,
  ApprovalRequest,
  Workflow,
  Module,
  TenantSlug,
  ResourceId,
} from "./types";

/**
 * useTenantAdminAPI - Generic hook for API calls with error handling
 */
export function useTenantAdminAPI<T>(
  url: string,
  options?: {
    method?: string;
    body?: any;
    manual?: boolean;
  }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!options?.manual);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        method: options?.method || "GET",
        headers: {
          "Content-Type": "application/json",
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Request failed");
      }

      const result = await response.json();
      setData(result.data || result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [url, options]);

  useEffect(() => {
    if (!options?.manual) {
      fetchData();
    }
  }, [fetchData, options?.manual]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * useDepartments - Hook for managing departments
 */
export function useDepartments(tenantSlug: TenantSlug) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDepartments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tenant/departments?tenantSlug=${tenantSlug}`);
      if (!res.ok) throw new Error("Failed to load departments");
      const data = await res.json();
      setDepartments(data.departments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  const createDepartment = useCallback(
    async (name: string, description?: string) => {
      try {
        const res = await fetch(`/api/tenant/departments?tenantSlug=${tenantSlug}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        });
        if (!res.ok) throw new Error("Failed to create department");
        await loadDepartments();
      } catch (err) {
        throw err;
      }
    },
    [tenantSlug, loadDepartments]
  );

  const deleteDepartment = useCallback(
    async (id: ResourceId) => {
      try {
        const res = await fetch(
          `/api/tenant/departments?id=${id}&tenantSlug=${tenantSlug}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Failed to delete department");
        await loadDepartments();
      } catch (err) {
        throw err;
      }
    },
    [tenantSlug, loadDepartments]
  );

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  return {
    departments,
    loading,
    error,
    createDepartment,
    deleteDepartment,
    refetch: loadDepartments,
  };
}

/**
 * useRoles - Hook for managing roles
 */
export function useRoles(tenantSlug: TenantSlug) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tenant/roles?tenantSlug=${tenantSlug}`);
      if (!res.ok) throw new Error("Failed to load roles");
      const data = await res.json();
      setRoles(data.roles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  return { roles, loading, error, refetch: loadRoles };
}

/**
 * useEmployees - Hook for managing employees
 */
export function useEmployees(tenantSlug: TenantSlug, departmentId?: ResourceId) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const url = `/api/tenant/employees?tenantSlug=${tenantSlug}${
        departmentId ? `&departmentId=${departmentId}` : ""
      }`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load employees");
      const data = await res.json();
      setEmployees(data.employees || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, departmentId]);

  const createEmployee = useCallback(
    async (employee: any) => {
      try {
        const res = await fetch(
          `/api/tenant/employees?tenantSlug=${tenantSlug}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(employee),
          }
        );
        if (!res.ok) throw new Error("Failed to create employee");
        await loadEmployees();
      } catch (err) {
        throw err;
      }
    },
    [tenantSlug, loadEmployees]
  );

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  return {
    employees,
    loading,
    error,
    createEmployee,
    refetch: loadEmployees,
  };
}

/**
 * useApprovals - Hook for managing approval requests
 */
export function useApprovals(tenantSlug: TenantSlug) {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadApprovals = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/tenant/approvals/requests?tenantSlug=${tenantSlug}`
      );
      if (!res.ok) throw new Error("Failed to load approvals");
      const data = await res.json();
      setApprovals(data.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  const approveRequest = useCallback(
    async (requestId: ResourceId, action: "approve" | "reject", comment?: string) => {
      try {
        const res = await fetch(
          `/api/tenant/approvals/requests/${requestId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, comment }),
          }
        );
        if (!res.ok) throw new Error("Failed to update approval");
        await loadApprovals();
      } catch (err) {
        throw err;
      }
    },
    [loadApprovals]
  );

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  return {
    approvals,
    loading,
    error,
    approveRequest,
    refetch: loadApprovals,
  };
}

/**
 * useModules - Hook for managing modules and feature flags
 */
export function useModules(tenantSlug: TenantSlug) {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadModules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tenant/modules?tenantSlug=${tenantSlug}`);
      if (!res.ok) throw new Error("Failed to load modules");
      const data = await res.json();
      setModules(data.modules || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  const toggleModule = useCallback(
    async (moduleId: ResourceId, enabled: boolean) => {
      try {
        const res = await fetch(
          `/api/tenant/modules/${moduleId}?tenantSlug=${tenantSlug}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled }),
          }
        );
        if (!res.ok) throw new Error("Failed to update module");
        await loadModules();
      } catch (err) {
        throw err;
      }
    },
    [tenantSlug, loadModules]
  );

  useEffect(() => {
    loadModules();
  }, [loadModules]);

  return {
    modules,
    loading,
    error,
    toggleModule,
    refetch: loadModules,
  };
}
