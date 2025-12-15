import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useParams } from 'react-router-dom'
import { useCreatePlan, useUpdatePlan, usePlan } from '../hooks/usePlans'

const planSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  description: z.string().optional(),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
  priceCents: z.number().min(0),
  currency: z.string().default('USD'),
  features: z.object({
    modules: z.array(z.string()).optional(),
    users: z.number().optional(),
    storage: z.string().optional(),
  }).optional(),
  isActive: z.boolean().default(true),
})

type PlanFormData = z.infer<typeof planSchema>

export function PlanEditor() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { data: plan } = usePlan(id || '')
  const createPlan = useCreatePlan()
  const updatePlan = useUpdatePlan()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: plan || {
      billingCycle: 'MONTHLY',
      currency: 'USD',
      priceCents: 0,
      isActive: true,
    },
  })

  const onSubmit = async (data: PlanFormData) => {
    try {
      if (id) {
        await updatePlan.mutateAsync({ id, data })
      } else {
        await createPlan.mutateAsync(data)
      }
      navigate('/plans')
    } catch (error) {
      console.error('Failed to save plan', error)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        {id ? 'Edit Plan' : 'Create New Plan'}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Plan Name
          </label>
          <input
            {...register('name')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {errors.name && (
            <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Slug
          </label>
          <input
            {...register('slug')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {errors.slug && (
            <p className="text-red-600 text-sm mt-1">{errors.slug.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            {...register('description')}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Billing Cycle
            </label>
            <select
              {...register('billingCycle')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price (cents)
            </label>
            <input
              type="number"
              {...register('priceCents', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            type="submit"
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            {id ? 'Update Plan' : 'Create Plan'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/plans')}
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

