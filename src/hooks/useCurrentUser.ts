"use client";

import { useState, useEffect } from "react";

export interface CurrentUser {
  id: string;
  roleId: string;
  tenantSlug?: string;
  name?: string;
  email?: string;
  department?: string;
}

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : undefined;
}

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const userId = getCookie("X-User-Id") || getCookie("dev-user-id") || getCookie("userId");
    const roleId = getCookie("X-Role-Id") || "viewer";
    const tenantSlug = getCookie("tenantSlug") || getCookie("X-Tenant-Slug");
    const name = getCookie("X-User-Name");
    const email = getCookie("X-User-Email");
    const department = getCookie("X-User-Department");

    if (userId) {
      setUser({ id: userId, roleId, tenantSlug, name, email, department });
    }
  }, []);

  return user;
}
