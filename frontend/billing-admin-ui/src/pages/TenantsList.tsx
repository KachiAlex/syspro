import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { tenantsApi } from '../api/billingClient'
import { formatCurrency, formatDate } from '../lib/utils'
import { Eye } from 'lucide-react'

export function TenantsList() {
  const [search, setSearch] = useState('')
  const { data: tenants, isLoading } = useQuery({
    queryKey: ['tenants', search],
    queryFn: async () => {
      const response = await tenantsApi.getAll({ search })
      return response.data
    },
  })

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tenants</h1>
          <p className="text-gray-600 mt-1">View and manage tenant billing</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Tenant Name
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Plan</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Next Billing
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  AR Balance
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {tenants?.map((tenant: any) => (
                <tr key={tenant.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">
                    {tenant.name || tenant.id}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {tenant.plan?.name || 'No plan'}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        tenant.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {tenant.status || 'N/A'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {tenant.nextBillingDate
                      ? formatDate(tenant.nextBillingDate)
                      : 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">
                    {formatCurrency(tenant.arBalance || 0)}
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      to={`/tenants/${tenant.id}/billing`}
                      className="flex items-center text-primary hover:underline"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Billing
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

