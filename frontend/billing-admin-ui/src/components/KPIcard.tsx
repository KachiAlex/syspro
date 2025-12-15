import { LucideIcon } from 'lucide-react'
import { formatCurrency } from '../lib/utils'

interface KPICardProps {
  title: string
  value: number | string
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  isCurrency?: boolean
  currency?: string
}

export function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  isCurrency = false,
  currency = 'USD',
}: KPICardProps) {
  const displayValue = isCurrency
    ? formatCurrency(typeof value === 'number' ? value : 0, currency)
    : value

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{displayValue}</p>
          {trend && (
            <p
              className={`text-sm mt-2 ${
                trend.isPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <div className="p-3 bg-primary/10 rounded-lg">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </div>
  )
}

