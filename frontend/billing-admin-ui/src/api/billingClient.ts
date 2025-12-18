import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const client = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token interceptor
client.interceptors.request.use((config) => {
  localStorage.removeItem('refreshToken')
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor to handle token refresh via HttpOnly cookie
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true

      try {
        const refreshResponse = await axios.post(`${API_BASE}/auth/refresh`, undefined, {
          withCredentials: true,
        })

        const { accessToken } = refreshResponse.data
        localStorage.setItem('accessToken', accessToken)
        originalRequest.headers.Authorization = `Bearer ${accessToken}`

        return client(originalRequest)
      } catch (refreshError) {
        localStorage.removeItem('accessToken')
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

// Plans API
export const plansApi = {
  getAll: () => client.get('/billing/plans'),
  getById: (id: string) => client.get(`/billing/plans/${id}`),
  create: (data: any) => client.post('/billing/plans', data),
  update: (id: string, data: any) => client.patch(`/billing/plans/${id}`, data),
  delete: (id: string) => client.delete(`/billing/plans/${id}`),
}

// Subscriptions API
export const subscriptionsApi = {
  getCurrent: () => client.get('/billing/subscription'),
  create: (data: { planId: string; gateway?: string; trialDays?: number }) =>
    client.post('/billing/subscription', data),
  upgrade: (id: string, data: { newPlanId: string }) =>
    client.post(`/billing/subscription/${id}/upgrade`, data),
  cancel: (id: string, data: { cancelAtPeriodEnd?: boolean }) =>
    client.post(`/billing/subscription/${id}/cancel`, data),
}

// Invoices API
export const invoicesApi = {
  getAll: (params?: { page?: number; limit?: number; status?: string }) =>
    client.get('/billing/invoices', { params }),
  getById: (id: string) => client.get(`/billing/invoices/${id}`),
  create: (data: any) => client.post('/billing/invoices', data),
  resend: (id: string) => client.post(`/billing/invoices/${id}/resend`),
  refund: (id: string, data: { amountCents?: number }) =>
    client.post(`/billing/invoices/${id}/refund`, data),
}

// Tenants API
export const tenantsApi = {
  getAll: (params?: { search?: string }) =>
    client.get('/billing/tenants', { params }),
  getById: (id: string) => client.get(`/billing/tenants/${id}`),
  getSubscription: (tenantId: string) =>
    client.get(`/billing/tenants/${tenantId}/subscription`),
  getInvoices: (tenantId: string, params?: any) =>
    client.get(`/billing/tenants/${tenantId}/invoices`, { params }),
  createInvoice: (tenantId: string, data: any) =>
    client.post(`/billing/tenants/${tenantId}/invoices`, data),
}

// Metering API
export const meteringApi = {
  recordEvent: (data: { eventType: string; value?: number; meta?: any }) =>
    client.post('/billing/metering/events', data),
  getUsage: () => client.get('/billing/metering/usage'),
  getTenantUsage: (tenantId: string, period?: string) =>
    client.get(`/billing/meters/${tenantId}/usage`, { params: { period } }),
}

// Reports API
export const reportsApi = {
  getRevenue: (startDate: string, endDate: string) =>
    client.get('/billing/reports/revenue', {
      params: { startDate, endDate },
    }),
  getAR: () => client.get('/billing/reports/ar'),
  getMRR: () => client.get('/billing/reports/mrr'),
  getARR: () => client.get('/billing/reports/arr'),
}

// Licenses API
export const licensesApi = {
  getAll: () => client.get('/billing/licenses'),
  enable: (moduleKey: string, data?: { quota?: number; expiresAt?: string }) =>
    client.post(`/billing/licenses/${moduleKey}/enable`, data),
  disable: (moduleKey: string) =>
    client.post(`/billing/licenses/${moduleKey}/disable`),
}

export default client

