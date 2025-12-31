'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Building2, Eye, EyeOff, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/auth-store'
import { useToast } from '@/hooks/use-toast'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  tenantId: z.string().uuid('Please enter a valid tenant ID'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading, error } = useAuthStore()
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'admin@syspro.com',
      password: 'Admin@123',
      tenantId: '', // Will be populated from demo
    },
  })

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(
        { email: data.email, password: data.password },
        data.tenantId
      )
      
      toast({
        title: 'Login successful',
        description: 'Welcome back to Syspro ERP!',
      })
      
      router.push('/dashboard')
    } catch (error) {
      toast({
        title: 'Login failed',
        description: error instanceof Error ? error.message : 'Please check your credentials',
        variant: 'destructive',
      })
    }
  }

  const fillDemoCredentials = () => {
    setValue('email', 'admin@syspro.com')
    setValue('password', 'Admin@123')
    // Note: You'll need to get the actual tenant ID from your database
    setValue('tenantId', '') // Leave empty - user needs to get this from database
    
    toast({
      title: 'Demo credentials loaded',
      description: 'Get your tenant ID from the database query: SELECT id FROM tenants WHERE code = \'PLATFORM\'',
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Building2 className="h-10 w-10 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to your Syspro ERP account
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Tenant ID */}
            <div className="space-y-2">
              <label htmlFor="tenantId" className="text-sm font-medium">
                Tenant ID
              </label>
              <Input
                id="tenantId"
                type="text"
                placeholder="Enter your tenant ID"
                {...register('tenantId')}
                className={errors.tenantId ? 'border-red-500' : ''}
              />
              {errors.tenantId && (
                <p className="text-sm text-red-500">{errors.tenantId.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                {...register('email')}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  {...register('password')}
                  className={errors.password ? 'border-red-500 pr-10' : 'pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            {/* Demo Button */}
            <Button
              type="button"
              variant="outline"
              onClick={fillDemoCredentials}
              className="w-full"
            >
              Load Demo Credentials
            </Button>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-gray-600">Don't have an account? </span>
            <Link
              href="/auth/register"
              className="text-blue-600 hover:text-blue-500 font-medium"
            >
              Sign up
            </Link>
          </div>

          <div className="mt-4 text-center">
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-gray-500"
            >
              ← Back to home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}