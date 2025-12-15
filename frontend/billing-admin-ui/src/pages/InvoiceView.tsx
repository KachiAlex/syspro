import { useParams } from 'react-router-dom'
import { useInvoice, useResendInvoice, useRefundInvoice } from '../hooks/useInvoices'
import { formatCurrency, formatDate } from '../lib/utils'
import { Download, Mail, RefreshCw } from 'lucide-react'

export function InvoiceView() {
  const { id } = useParams()
  const { data: invoice, isLoading } = useInvoice(id || '')
  const resendInvoice = useResendInvoice()
  const refundInvoice = useRefundInvoice()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!invoice) {
    return <div>Invoice not found</div>
  }

  const handleResend = async () => {
    if (id) {
      await resendInvoice.mutateAsync(id)
    }
  }

  const handleRefund = async () => {
    if (id) {
      await refundInvoice.mutateAsync({ id })
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoice {invoice.invoiceNumber}</h1>
          <p className="text-gray-600 mt-1">Issued on {formatDate(invoice.issuedAt)}</p>
        </div>
        <div className="flex items-center space-x-2">
          {invoice.pdfUrl && (
            <a
              href={invoice.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </a>
          )}
          <button
            onClick={handleResend}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Mail className="h-4 w-4 mr-2" />
            Resend
          </button>
          {invoice.status === 'paid' && (
            <button
              onClick={handleRefund}
              className="flex items-center px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refund
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-sm font-medium text-gray-700">Status</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{invoice.status}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Due Date</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {formatDate(invoice.dueAt)}
            </p>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Line Items</h3>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 text-sm font-medium text-gray-700">
                  Description
                </th>
                <th className="text-right py-2 text-sm font-medium text-gray-700">
                  Quantity
                </th>
                <th className="text-right py-2 text-sm font-medium text-gray-700">
                  Unit Price
                </th>
                <th className="text-right py-2 text-sm font-medium text-gray-700">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems?.map((item: any, index: number) => (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-3 text-sm text-gray-900">{item.description}</td>
                  <td className="py-3 text-right text-sm text-gray-600">{item.quantity}</td>
                  <td className="py-3 text-right text-sm text-gray-600">
                    {formatCurrency(item.unitPriceCents, invoice.currency)}
                  </td>
                  <td className="py-3 text-right text-sm font-medium text-gray-900">
                    {formatCurrency(item.totalCents, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="py-3 text-right text-sm font-medium text-gray-700">
                  Total
                </td>
                <td className="py-3 text-right text-lg font-bold text-gray-900">
                  {formatCurrency(invoice.amountDueCents, invoice.currency)}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="py-3 text-right text-sm font-medium text-gray-700">
                  Amount Paid
                </td>
                <td className="py-3 text-right text-sm text-gray-600">
                  {formatCurrency(invoice.amountPaidCents, invoice.currency)}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="py-3 text-right text-sm font-medium text-gray-700">
                  Amount Due
                </td>
                <td className="py-3 text-right text-lg font-bold text-gray-900">
                  {formatCurrency(
                    invoice.amountDueCents - invoice.amountPaidCents,
                    invoice.currency
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {invoice.payments && invoice.payments.length > 0 && (
          <div className="border-t border-gray-200 pt-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h3>
            <div className="space-y-2">
              {invoice.payments.map((payment: any) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(payment.amountCents, payment.currency)}
                    </p>
                    <p className="text-xs text-gray-600">
                      {payment.gateway} • {payment.paidAt ? formatDate(payment.paidAt) : 'Pending'}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      payment.status === 'succeeded'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {payment.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

