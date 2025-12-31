'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, Shield, BarChart3, LogOut, User } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated, logout, isLoading } = useAuthStore()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login')
    }
  }, [isAuthenticated, isLoading, router])

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  const stats = [
    {
      title: 'Total Users',
      value: '1,234',
      description: 'Active users in your tenant',
      icon: Users,
      color: 'text-blue-600',
    },
    {
      title: 'Organizations',
      value: '12',
      description: 'Organizational units',
      icon: Building2,
      color: 'text-green-600',
    },
    {
      title: 'Roles',
      value: '8',
      description: 'User roles configured',
      icon: Shield,
      color: 'text-purple-600',
    },
    {
      title: 'Reports',
      value: '45',
      description: 'Generated this month',
      icon: BarChart3,
      color: 'text-orange-600',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Building2 className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Syspro ERP</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-gray-500" />
                <span className="text-sm text-gray-700">
                  {user.firstName} {user.lastName}
                </span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {user.roles[0] || 'User'}
                </span>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user.firstName}!
          </h2>
          <p className="text-gray-600">
            Here's what's happening in your organization today.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common tasks and shortcuts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start" variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Manage Users
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Building2 className="mr-2 h-4 w-4" />
                View Organizations
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <BarChart3 className="mr-2 h-4 w-4" />
                Generate Report
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>
                Your account and system details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Email:</span>
                <span className="text-sm font-medium">{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Role:</span>
                <span className="text-sm font-medium">{user.roles.join(', ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Tenant ID:</span>
                <span className="text-sm font-mono text-xs">{user.tenantId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Permissions:</span>
                <span className="text-sm font-medium">{user.permissions.length} granted</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}