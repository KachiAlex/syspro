import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';
import { DashboardSummary } from '../lib/types/shared';

export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: ['dashboard', 'summary'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const response = await apiClient.getDashboardSummary();

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Unable to load dashboard summary');
      }

      return response.data;
    },
  });
}
