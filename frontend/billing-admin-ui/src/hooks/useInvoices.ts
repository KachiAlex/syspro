import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoicesApi } from '../api/billingClient'

export const useInvoices = (params?: { page?: number; limit?: number; status?: string }) => {
  return useQuery({
    queryKey: ['invoices', params],
    queryFn: async () => {
      const response = await invoicesApi.getAll(params)
      return response.data
    },
  })
}

export const useInvoice = (id: string) => {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const response = await invoicesApi.getById(id)
      return response.data
    },
    enabled: !!id,
  })
}

export const useResendInvoice = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invoicesApi.resend(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export const useRefundInvoice = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, amountCents }: { id: string; amountCents?: number }) =>
      invoicesApi.refund(id, { amountCents }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

