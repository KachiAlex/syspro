export class AdminService {
  static async getUsers(tenantSlug: string) {
    const res = await fetch(`/api/tenant/users?tenantSlug=${encodeURIComponent(tenantSlug)}`);
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json();
  }

  static async getAuditLogs(tenantSlug: string) {
    const res = await fetch(`/api/tenant/audit?tenantSlug=${encodeURIComponent(tenantSlug)}`);
    if (!res.ok) throw new Error("Failed to fetch audit logs");
    return res.json();
  }

  static async getHealth(tenantSlug: string) {
    const res = await fetch(`/api/tenant/health?tenantSlug=${encodeURIComponent(tenantSlug)}`);
    if (!res.ok) throw new Error("Failed to fetch health");
    return res.json();
  }

  static async getBranches(tenantSlug: string) {
    const res = await fetch(`/api/tenant/branches?tenantSlug=${encodeURIComponent(tenantSlug)}`);
    if (!res.ok) throw new Error("Failed to fetch branches");
    return res.json();
  }

  static async getAccessControl(tenantSlug: string) {
    const res = await fetch(`/api/tenant/access-control?tenantSlug=${encodeURIComponent(tenantSlug)}`);
    if (!res.ok) throw new Error("Failed to fetch access control");
    return res.json();
  }

  static async getBilling(tenantSlug: string) {
    const res = await fetch(`/api/tenant/billing?tenantSlug=${encodeURIComponent(tenantSlug)}`);
    if (!res.ok) throw new Error("Failed to fetch billing");
    return res.json();
  }

  static async getIntegrations(tenantSlug: string) {
    const res = await fetch(`/api/tenant/integrations?tenantSlug=${encodeURIComponent(tenantSlug)}`);
    if (!res.ok) throw new Error("Failed to fetch integrations");
    return res.json();
  }

  static async getRoles(tenantSlug: string) {
    const res = await fetch(`/api/tenant/roles?tenantSlug=${encodeURIComponent(tenantSlug)}`);
    if (!res.ok) throw new Error("Failed to fetch roles");
    return res.json();
  }

  static async getOrgStructure(tenantSlug: string) {
    const res = await fetch(`/api/tenant/org-structure?tenantSlug=${encodeURIComponent(tenantSlug)}`);
    if (!res.ok) throw new Error("Failed to fetch org structure");
    return res.json();
  }

  static async createBranch(tenantSlug: string, payload: any) {
    const res = await fetch(`/api/tenant/org-structure?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create branch");
    return res.json();
  }

  static async saveAccessRestrictions(tenantSlug: string, restrictions: string[]) {
    const res = await fetch(`/api/tenant/access-restrictions?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantSlug, restrictions }),
    });
    if (!res.ok) throw new Error("Failed to save access restrictions");
    return res.json();
  }

  static async createUser(tenantSlug: string, user: any) {
    const res = await fetch(`/api/tenant/users?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    });
    if (!res.ok) throw new Error("Failed to create user");
    return res.json();
  }
}
