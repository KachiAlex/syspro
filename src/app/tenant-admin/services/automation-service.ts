import { apiClient } from "@/lib/api-client";

export class AutomationService {
  static async getSummary(tenantSlug: string) {
    const response = await apiClient.get(`/automation/summary?tenantSlug=${encodeURIComponent(tenantSlug)}`);
    return response.data;
  }

  static async getRules(tenantSlug: string) {
    const response = await apiClient.get(`/automation/rules?tenantSlug=${encodeURIComponent(tenantSlug)}`);
    return response.data;
  }

  static async getAudits(tenantSlug: string, limit = 50) {
    const response = await apiClient.get(`/automation/audit?tenantSlug=${encodeURIComponent(tenantSlug)}&limit=${limit}`);
    return response.data;
  }

  static async publishEvent(tenantSlug: string, event: { type: string; payload?: any; actor?: string; simulation?: boolean }) {
    const response = await apiClient.post(`/automation?tenantSlug=${encodeURIComponent(tenantSlug)}`, event);
    return response.data;
  }
}
