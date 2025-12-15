import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tenantsApi, subscriptionsApi } from '../api/billingClient'
import { formatCurrency, formatDate } from '../lib/utils'

export function TenantBilling() {
  const { id } = useParams()
  const [activeTab, setActiveTab] = useState<'subscription' | 'invoices' | 'usage'>('subscription')

  const { data: tenant } = useQuery({
    queryKey: ['tenant', id],
    queryFn: async () => {
      const response = await tenantsApi.getById(id || '')
      return response.data
    },
    enabled: !!id,
  })

  const { data: subscription } = useQuery({
    queryKey: ['subscription', 'tenant', id],
    queryFn: async () => {
      const response = await tenantsApi.getSubscription(id || '')
      return response.data
    },
    enabled: !!id,
  })

  const { data: invoices } = useQuery({
    queryKey: ['invoices', 'tenant', id],
    queryFn: async () => {
      const response = await tenantsApi.getInvoices(id || '')
      return response.data
    },
    enabled: !!id && activeTab === 'invoices',
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {tenant?.name || 'Tenant'} Billing
        </h1>
        <p className="text-gray-600 mt-1">Manage subscription and billing for this tenant</p>
      </div>

      {/* Subscription Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Current Subscription</h2>
            <p className="text-sm text-gray-600 mt-1">
              {subscription?.plan?.name || 'No active subscription'}
            </p>
          </div>
          <div className="flex space-x-2">
            <button className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
              Upgrade/Downgrade
            </button>
            <button className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50">
              Cancel
            </button>
          </div>
        </div>

        {subscription && (
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="text-lg font-semibold text-gray-900">{subscription.status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Period</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatDate(subscription.currentPeriodStart)} -{' '}
                {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Next Billing</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {(['subscription', 'invoices', 'usage'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'invoices' && (
            <div className="space-y-4">
              {invoices?.data?.map((invoice: any) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-md"
                >
                  <div>
                    <p className="font-medium text-gray-900">{invoice.invoiceNumber}</p>
                    <p className="text-sm text-gray-600">
                      {formatDate(invoice.issuedAt)} •{' '}
                      {formatCurrency(invoice.amountDueCents, invoice.currency)}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      invoice.status === 'paid'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {invoice.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'usage' && (
            <div>
              <p className="text-gray-600">Usage data will be displayed here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

