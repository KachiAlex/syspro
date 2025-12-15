import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { meteringApi } from '../api/billingClient'

export const useMeteringUsage = () => {
  return useQuery({
    queryKey: ['metering', 'usage'],
    queryFn: async () => {
      const response = await meteringApi.getUsage()
      return response.data
    },
  })
}

export const useTenantMetering = (tenantId: string, period?: string) => {
  return useQuery({
    queryKey: ['metering', 'tenant', tenantId, period],
    queryFn: async () => {
      const response = await meteringApi.getTenantUsage(tenantId, period)
      return response.data
    },
    enabled: !!tenantId,
  })
}

export const useRecordMeterEvent = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { eventType: string; value?: number; meta?: any }) =>
      meteringApi.recordEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metering'] })
    },
  })
}

