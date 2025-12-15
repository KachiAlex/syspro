import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { plansApi } from '../api/billingClient'

export const usePlans = () => {
  return useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const response = await plansApi.getAll()
      return response.data
    },
  })
}

export const usePlan = (id: string) => {
  return useQuery({
    queryKey: ['plan', id],
    queryFn: async () => {
      const response = await plansApi.getById(id)
      return response.data
    },
    enabled: !!id,
  })
}

export const useCreatePlan = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => plansApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
    },
  })
}

export const useUpdatePlan = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      plansApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      queryClient.invalidateQueries({ queryKey: ['plan', variables.id] })
    },
  })
}

