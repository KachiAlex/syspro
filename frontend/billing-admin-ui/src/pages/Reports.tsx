import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '../api/billingClient'
import { formatCurrency } from '../lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export function Reports() {
  const { data: ar } = useQuery({
    queryKey: ['ar-report'],
    queryFn: async () => {
      const response = await reportsApi.getAR()
      return response.data
    },
  })

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

  const arData = ar
    ? [
        { name: 'Current', value: ar.current },
        { name: '31-60 Days', value: ar.days31_60 },
        { name: '61-90 Days', value: ar.days61_90 },
        { name: 'Over 90 Days', value: ar.over90 },
      ]
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Billing Reports</h1>
          <p className="text-gray-600 mt-1">Analytics and financial reports</p>
        </div>
        <button className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
          Export CSV
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600">MRR</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {formatCurrency(mrr?.mrr ? mrr.mrr * 100 : 0)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600">ARR</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {formatCurrency(arr?.arr ? arr.arr * 100 : 0)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600">Total AR</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {formatCurrency(ar?.total ? ar.total * 100 : 0)}
          </p>
        </div>
      </div>

      {/* AR Aging Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">AR Aging Report</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={arData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(value: number) => formatCurrency(value * 100)} />
            <Bar dataKey="value" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* AR Aging Table */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">AR Aging Details</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Period</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-3 px-4 text-sm text-gray-900">Current (0-30 days)</td>
              <td className="py-3 px-4 text-right text-sm font-medium text-gray-900">
                {formatCurrency(ar?.current ? ar.current * 100 : 0)}
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-3 px-4 text-sm text-gray-900">31-60 days</td>
              <td className="py-3 px-4 text-right text-sm font-medium text-gray-900">
                {formatCurrency(ar?.days31_60 ? ar.days31_60 * 100 : 0)}
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-3 px-4 text-sm text-gray-900">61-90 days</td>
              <td className="py-3 px-4 text-right text-sm font-medium text-gray-900">
                {formatCurrency(ar?.days61_90 ? ar.days61_90 * 100 : 0)}
              </td>
            </tr>
            <tr>
              <td className="py-3 px-4 text-sm font-medium text-gray-900">Over 90 days</td>
              <td className="py-3 px-4 text-right text-sm font-medium text-red-600">
                {formatCurrency(ar?.over90 ? ar.over90 * 100 : 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

