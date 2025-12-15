import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { subscriptionsApi } from '../api/billingClient'

export const useCurrentSubscription = () => {
  return useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: async () => {
      const response = await subscriptionsApi.getCurrent()
      return response.data
    },
  })
}

export const useCreateSubscription = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { planId: string; gateway?: string; trialDays?: number }) =>
      subscriptionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
    },
  })
}

export const useUpgradeSubscription = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, newPlanId }: { id: string; newPlanId: string }) =>
      subscriptionsApi.upgrade(id, { newPlanId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
    },
  })
}

export const useCancelSubscription = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, cancelAtPeriodEnd }: { id: string; cancelAtPeriodEnd?: boolean }) =>
      subscriptionsApi.cancel(id, { cancelAtPeriodEnd }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
    },
  })
}

