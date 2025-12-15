import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { plansApi } from '../api/billingClient'
import { formatCurrency } from '../lib/utils'

export function Plans() {
  const { data: plans, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const response = await plansApi.getAll()
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
          <h1 className="text-3xl font-bold text-gray-900">Subscription Plans</h1>
          <p className="text-gray-600 mt-1">Manage subscription plans and pricing</p>
        </div>
        <Link
          to="/plans/new"
          className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Plan
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans?.map((plan: any) => (
          <div
            key={plan.id}
            className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  plan.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {plan.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
            <div className="mb-4">
              <span className="text-3xl font-bold text-gray-900">
                {formatCurrency(plan.priceCents, plan.currency)}
              </span>
              <span className="text-gray-600 text-sm ml-2">
                /{plan.billingCycle === 'MONTHLY' ? 'month' : 'year'}
              </span>
            </div>
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Features:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {plan.features?.modules && (
                  <li>Modules: {Array.isArray(plan.features.modules) ? plan.features.modules.join(', ') : 'All'}</li>
                )}
                {plan.features?.users && (
                  <li>Users: {plan.features.users === -1 ? 'Unlimited' : plan.features.users}</li>
                )}
                {plan.features?.storage && (
                  <li>Storage: {plan.features.storage}</li>
                )}
              </ul>
            </div>
            <div className="flex items-center space-x-2 pt-4 border-t border-gray-200">
              <Link
                to={`/plans/${plan.id}/edit`}
                className="flex-1 flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Link>
              <button className="px-3 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 text-sm">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

