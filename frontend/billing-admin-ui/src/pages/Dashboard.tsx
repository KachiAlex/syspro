import { useQuery } from '@tanstack/react-query'
import { KPICard } from '../components/KPIcard'
import { DollarSign, TrendingUp, AlertCircle, Users, XCircle } from 'lucide-react'
import { reportsApi, invoicesApi } from '../api/billingClient'
import { formatCurrency, formatDate } from '../lib/utils'

export function Dashboard() {
  const { data: mrr } = useQuery({
    queryKey: ['mrr'],
    queryFn: async () => {
      const response = await reportsApi.getMRR()
      return response.data
    },
  })

  const { data: arr } = useQuery({
    queryKey: ['arr'],
    queryFn: async () => {
      const response = await reportsApi.getARR()
      return response.data
    },
  })

  const { data: ar } = useQuery({
    queryKey: ['ar'],
    queryFn: async () => {
      const response = await reportsApi.getAR()
      return response.data
    },
  })

  const { data: invoices } = useQuery({
    queryKey: ['invoices', 'recent'],
    queryFn: async () => {
      const response = await invoicesApi.getAll({ limit: 5 })
      return response.data
    },
  })

  const outstandingAR = ar?.total ? ar.total * 100 : 0
  const activeSubscriptions = 0 // TODO: Get from API
  const churnRate = 2.5 // TODO: Calculate from data
  const dunningCount = 0 // TODO: Get failed payments count

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Billing Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of billing metrics and recent activity</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          title="MRR"
          value={mrr?.mrr ? mrr.mrr * 100 : 0}
          icon={DollarSign}
          isCurrency
          trend={{ value: 5.2, isPositive: true }}
        />
        <KPICard
          title="ARR"
          value={arr?.arr ? arr.arr * 100 : 0}
          icon={TrendingUp}
          isCurrency
          trend={{ value: 12.8, isPositive: true }}
        />
        <KPICard
          title="Outstanding AR"
          value={outstandingAR}
          icon={AlertCircle}
          isCurrency
        />
        <KPICard
          title="Dunning"
          value={dunningCount}
          icon={XCircle}
        />
        <KPICard
          title="Active Subscriptions"
          value={activeSubscriptions}
          icon={Users}
        />
        <KPICard
          title="Churn Rate"
          value={`${churnRate}%`}
          icon={TrendingUp}
          trend={{ value: 0.5, isPositive: false }}
        />
      </div>

      {/* Recent Invoices */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Invoices</h2>
          <a href="/invoices" className="text-sm text-primary hover:underline">
            View all
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Invoice #
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Date
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Amount
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {invoices?.data?.map((invoice: any) => (
                <tr key={invoice.id} className="border-b border-gray-100">
                  <td className="py-3 px-4 text-sm text-gray-900">
                    {invoice.invoiceNumber}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {formatDate(invoice.issuedAt)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-900">
                    {formatCurrency(invoice.amountDueCents, invoice.currency)}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        invoice.status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : invoice.status === 'open'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {invoice.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
            Create Manual Invoice
          </button>
          <button className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
            Issue Refund
          </button>
          <button className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
            Send Reminder
          </button>
        </div>
      </div>
    </div>
  )
}

