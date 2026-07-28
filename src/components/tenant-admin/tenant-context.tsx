"use client";

import { createContext, useContext, useMemo } from "react";

type TenantContextValue = {
  tenantSlug: string;
  regionId: string;
  regionName: string;
  branchId: string;
  branchName: string;
  currency: string;
};

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

type TenantContextProviderProps = {
  value: TenantContextValue;
  children: React.ReactNode;
};

export function TenantContextProvider({ value, children }: TenantContextProviderProps) {
  const normalized = useMemo(() => {
    return {
      tenantSlug: value.tenantSlug,
      regionId: value.regionId,
      regionName: value.regionName || "Primary Region",
      branchId: value.branchId,
      branchName: value.branchName || "Headquarters",
      currency: value.currency || "USD",
    } satisfies TenantContextValue;
  }, [value]);

  return <TenantContext.Provider value={normalized}>{children}</TenantContext.Provider>;
}

export function useTenantContext() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenantContext must be used within a TenantContextProvider");
  }
  return context;
}

const FALLBACK_TENANT_CONTEXT: TenantContextValue = {
  tenantSlug: "",
  regionId: "default",
  regionName: "Primary Region",
  branchId: "default",
  branchName: "Headquarters",
  currency: "USD",
};

export function useTenantContextSafe(): TenantContextValue {
  const context = useContext(TenantContext);
  return context ?? FALLBACK_TENANT_CONTEXT;
}
