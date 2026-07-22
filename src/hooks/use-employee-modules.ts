"use client";

import { useEffect, useState } from "react";

export interface EmployeeModulePermissions {
  modules: Record<string, boolean>;
  isEmployee: boolean;
  loading: boolean;
}

const DEFAULT: EmployeeModulePermissions = {
  modules: {},
  isEmployee: false,
  loading: true,
};

export function useEmployeeModules(): EmployeeModulePermissions {
  const [state, setState] = useState<EmployeeModulePermissions>(DEFAULT);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/hr/employees/me", { cache: "no-store" });
        if (!res.ok) {
          setState({ modules: {}, isEmployee: false, loading: false });
          return;
        }
        const data = await res.json();
        if (data.employee) {
          const perms = data.employee.portalPermissions || {};
          setState({
            modules: perms,
            isEmployee: true,
            loading: false,
          });
        } else {
          setState({ modules: {}, isEmployee: false, loading: false });
        }
      } catch {
        setState({ modules: {}, isEmployee: false, loading: false });
      }
    }
    load();
  }, []);

  return state;
}
