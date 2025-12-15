import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInvoices } from '../hooks/useInvoices'
import { formatCurrency, formatDate } from '../lib/utils'
import { Download, Eye } from 'lucide-react'

export function InvoicesList() {
  const [status, setStatus] = useState<string>('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useInvoices({ page, limit: 20, status: status || undefined })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'open':
        return 'bg-amber-100 text-amber-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600 mt-1">View and manage all invoices</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-4 mb-6">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="open">Open</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Invoice #
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Tenant
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Issued
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Due
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Amount Due
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.map((invoice: any) => (
                <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm text-gray-900">
                    {invoice.invoiceNumber}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {invoice.tenantId}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {formatDate(invoice.issuedAt)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {formatDate(invoice.dueAt)}
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">
                    {formatCurrency(invoice.amountDueCents - invoice.amountPaidCents, invoice.currency)}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(invoice.status)}`}
                    >
                      {invoice.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/invoices/${invoice.id}`}
                        className="p-1 text-gray-600 hover:text-gray-900"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      {invoice.pdfUrl && (
                        <a
                          href={invoice.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-gray-600 hover:text-gray-900"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-600">
              Page {page} of {data.totalPages}
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

