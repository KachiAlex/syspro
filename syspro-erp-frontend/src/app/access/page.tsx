"use client";

import { useState } from 'react';
import Link from "next/link";
import { ArrowRight, Users, Building, Mail, Lock, Eye, EyeOff, ChevronRight, Star, Zap, Globe, Shield, CheckCircle } from "lucide-react";
import { ImageWithFallback } from '@/components/ImageWithFallback';

export default function AccessPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle tenant login logic here
    console.log('Tenant login attempt:', { email, password });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="pro-header">
        <div className="pro-header-logo">S <span>Syspro</span></div>
        <nav className="pro-header-nav">
          <a href="#features">Product</a>
          <a href="#solutions">Solutions</a>
          <a href="#pricing">Pricing</a>
          <a href="#resources">Resources</a>
        </nav>
        <div className="pro-header-actions">
          <button className="pro-btn">Back to Home</button>
          <button className="pro-btn pro-btn-primary">Request demo</button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pro-home-main" style={{ paddingTop: '4rem' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            {/* Left Side - Tenant Login Form */}
            <div>
              {/* Tenant Login Header */}
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
                  <Building size={14} />
                  Tenant Portal
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Welcome Back
                </h2>
                <p className="text-gray-600">
                  Sign in to access your organization's dashboard and manage your business operations
                </p>
              </div>

              {/* Login Form */}
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <form onSubmit={handleLogin} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="your-email@company.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center">
                      <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                      <span className="ml-2 text-sm text-gray-600">Remember me</span>
                    </label>
                    <a href="#" className="text-sm text-blue-600 hover:text-blue-700">
                      Forgot password?
                    </a>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                  >
                    Sign In to Tenant Dashboard <ArrowRight size={18} />
                  </button>
                </form>

                {/* Quick Access Links */}
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-4">Quick Access:</p>
                  <div className="space-y-2">
                    <Link 
                      href="/tenant-admin"
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                    >
                      <span className="text-sm font-medium text-gray-700">
                        Go to Tenant Dashboard
                      </span>
                      <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-600" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Help Section */}
              <div className="mt-6 bg-blue-50 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="text-blue-600 mt-0.5" size={20} />
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Need Help?</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Contact your organization's administrator for access credentials
                    </p>
                    <a href="#" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                      Contact Support →
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Visual Content */}
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
                <div className="mb-6">
                  <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium mb-4">
                    <Zap size={14} />
                    Enterprise-Grade Security
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Your Business Command Center
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Manage your entire organization with our comprehensive ERP platform. From CRM to finance, everything you need in one place.
                  </p>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl">
                    <Users className="text-blue-600 mb-2" size={24} />
                    <h4 className="font-semibold text-gray-900 mb-1">CRM</h4>
                    <p className="text-sm text-gray-600">Customer relationship management</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl">
                    <Shield className="text-green-600 mb-2" size={24} />
                    <h4 className="font-semibold text-gray-900 mb-1">Finance</h4>
                    <p className="text-sm text-gray-600">Complete financial oversight</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-4 rounded-xl">
                    <Globe className="text-purple-600 mb-2" size={24} />
                    <h4 className="font-semibold text-gray-900 mb-1">Projects</h4>
                    <p className="text-sm text-gray-600">Project management & tracking</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-xl">
                    <Star className="text-orange-600 mb-2" size={24} />
                    <h4 className="font-semibold text-gray-900 mb-1">Analytics</h4>
                    <p className="text-sm text-gray-600">Real-time business insights</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold">10K+</div>
                      <div className="text-sm opacity-90">Businesses</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">99.9%</div>
                      <div className="text-sm opacity-90">Uptime</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">24/7</div>
                      <div className="text-sm opacity-90">Support</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Testimonial */}
              <div className="mt-8 bg-white rounded-xl p-6 shadow-lg border border-gray-100">
                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} size={16} className="fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4">
                  "Syspro has transformed how we manage our operations. Everything we need is in one place, from customer relationships to financial reporting."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                    SM
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Sarah Martinez</div>
                    <div className="text-sm text-gray-600">Operations Manager, TechCorp</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
