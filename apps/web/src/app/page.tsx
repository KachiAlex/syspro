'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiClient } from '@/lib/api'
import { Building2, Users, Shield, BarChart3, Zap, Globe } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const [apiStatus, setApiStatus] = useState<'checking' | 'healthy' | 'error'>('checking')

  useEffect(() => {
    // Check API health
    apiClient.healthCheck()
      .then(() => setApiStatus('healthy'))
      .catch(() => setApiStatus('error'))

    // Redirect if authenticated
    if (isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, router])

  const features = [
    {
      icon: Building2,
      title: 'Multi-Tenant Architecture',
      description: 'Complete tenant isolation with organization hierarchy and custom branding.',
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'JWT authentication, RBAC, audit logging, and comprehensive access control.',
    },
    {
      icon: Users,
      title: 'User Management',
      description: 'Role-based permissions, organization structure, and user lifecycle management.',
    },
    {
      icon: BarChart3,
      title: 'Business Intelligence',
      description: 'Real-time analytics, custom reports, and data-driven insights.',
    },
    {
      icon: Zap,
      title: 'High Performance',
      description: 'Optimized for scale with caching, database optimization, and serverless architecture.',
    },
    {
      icon: Globe,
      title: 'API-First Design',
      description: 'RESTful APIs with comprehensive documentation and integration capabilities.',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Syspro ERP</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                apiStatus === 'healthy' ? 'bg-green-500' : 
                apiStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
              }`} />
              <span className="text-sm text-gray-600">
                API {apiStatus === 'healthy' ? 'Online' : apiStatus === 'error' ? 'Offline' : 'Checking...'}
              </span>
            </div>
            <Button 
              variant="outline" 
              onClick={() => router.push('/auth/login')}
            >
              Sign In
            </Button>
            <Button onClick={() => router.push('/auth/register')}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Production-Ready
            <span className="text-blue-600"> Multi-Tenant ERP</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Built with NestJS, React, and PostgreSQL. Enterprise-grade security, 
            scalable architecture, and comprehensive business management tools.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => router.push('/auth/register')}
              className="text-lg px-8 py-3"
            >
              Start Free Trial
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => router.push('/demo')}
              className="text-lg px-8 py-3"
            >
              View Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h3 className="text-3xl font-bold text-gray-900 mb-4">
            Enterprise Features
          </h3>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Everything you need to manage your business operations with confidence and scale.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <feature.icon className="h-12 w-12 text-blue-600 mb-4" />
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* API Status Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">System Status</CardTitle>
            <CardDescription>
              Real-time status of Syspro ERP services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="font-medium">API Server</span>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  apiStatus === 'healthy' ? 'bg-green-500' : 
                  apiStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
                <span className="text-sm font-medium">
                  {apiStatus === 'healthy' ? 'Operational' : 
                   apiStatus === 'error' ? 'Down' : 'Checking...'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="font-medium">Database</span>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm font-medium">Operational</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="font-medium">Authentication</span>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm font-medium">Operational</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <Building2 className="h-6 w-6 text-blue-600" />
              <span className="font-semibold text-gray-900">Syspro ERP</span>
            </div>
            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <a href="/api/docs" className="hover:text-blue-600 transition-colors">
                API Documentation
              </a>
              <a href="/api/v1/health" className="hover:text-blue-600 transition-colors">
                Health Check
              </a>
              <span>© 2024 Syspro ERP. All rights reserved.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}