import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  CreditCard,
  Users,
  FileText,
  BarChart3,
  Settings,
  Activity,
} from 'lucide-react'
import { cn } from '../lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Plans', href: '/plans', icon: CreditCard },
  { name: 'Tenants', href: '/tenants', icon: Users },
  { name: 'Invoices', href: '/invoices', icon: FileText },
  { name: 'Metering', href: '/metering', icon: Activity },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const location = useLocation()

  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen">
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900">Billing Admin</h1>
        <p className="text-sm text-gray-500 mt-1">Syspro ERP</p>
      </div>
      <nav className="px-3 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

