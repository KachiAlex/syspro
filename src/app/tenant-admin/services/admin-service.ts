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

  static async getOrgStructure(tenantSlug: string) {
    const res = await fetch(`/api/tenant/org-structure?tenantSlug=${encodeURIComponent(tenantSlug)}`);
    if (!res.ok) throw new Error("Failed to fetch org structure");
    return res.json();
  }
}
