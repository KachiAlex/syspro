'use client';

/**
 * Home Page - Modern landing page for Syspro ERP
 * Features modern design with gradients, illustrations, and clear value propositions
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/auth-context';
import { LoadingSpinner } from '../components/ui/loading-spinner';
import { ArrowRight, BarChart3, Users, Shield, Zap, CheckCircle, Star } from 'lucide-react';

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push('/dashboard');
      } else {
        // Show landing page for unauthenticated users
        setShowLanding(true);
      }
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading while determining authentication state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="text-center">
          <LoadingSpinner size="xl" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            Syspro ERP System
          </h2>
          <p className="mt-2 text-gray-600">Initializing...</p>
        </div>
      </div>
    );
  }

  // Show modern landing page for unauthenticated users
  if (showLanding) {
    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400"></div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* Navigation */}
            <nav className="flex items-center justify-between py-6">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-white">Syspro</h1>
                <span className="ml-2 text-white/80 text-sm">Innovation that flows</span>
              </div>
              <button
                onClick={() => router.push('/login')}
                className="bg-white/20 backdrop-blur-sm text-white px-6 py-2 rounded-full hover:bg-white/30 transition-all duration-200 border border-white/20"
              >
                Get Started
              </button>
            </nav>

            {/* Hero Section */}
            <div className="py-14 lg:py-20">
              <div className="grid lg:grid-cols-2 gap-10 items-center">
                <div>
                  <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
                    Tech doesn't have to feel like a different language
                  </h2>
                  <p className="mt-5 text-lg text-white/90 leading-relaxed">
                    One of the best business management systems that helps you manage your business with ease and efficiency.
                  </p>
                  <button
                    onClick={() => router.push('/login')}
                    className="mt-6 bg-white text-purple-600 px-7 py-3 rounded-full font-semibold hover:bg-gray-50 transition-all duration-200 inline-flex items-center gap-2 shadow-lg"
                  >
                    Get Started
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
                <div className="relative">
                  {/* Illustration placeholder - you can replace with actual illustration */}
                  <div className="relative w-full h-72 lg:h-80 bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20 flex items-center justify-center">
                    <div className="text-center text-white/60">
                      <BarChart3 className="w-20 h-20 mx-auto mb-3" />
                      <p className="text-base lg:text-lg">Modern Business Illustration</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </header>

        {/* Features Section */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center p-8 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Accounting Software</h3>
                <p className="text-gray-600">Streamline your financial processes with our comprehensive accounting solution.</p>
              </div>

              <div className="text-center p-8 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-orange-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">HR & Payroll System</h3>
                <p className="text-gray-600">Manage your workforce efficiently with integrated HR and payroll management.</p>
              </div>

              <div className="text-center p-8 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Project Management</h3>
                <p className="text-gray-600">Keep your projects on track with powerful project management tools.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Innovation Section */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-4xl font-bold text-gray-900 mb-6">
                  Innovation that flows
                </h2>
                
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Seamless integrations</h3>
                      <p className="text-gray-600">Connect with your favorite tools and services for a unified workflow experience.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <Zap className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Intuitive user interface</h3>
                      <p className="text-gray-600">Designed with simplicity in mind, making complex business processes feel natural.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <Star className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Excellent customer support</h3>
                      <p className="text-gray-600">Our dedicated support team is here to help you succeed every step of the way.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="relative w-full h-96 bg-gradient-to-br from-purple-100 to-pink-100 rounded-3xl flex items-center justify-center">
                  <div className="text-center text-purple-600">
                    <Users className="w-24 h-24 mx-auto mb-4" />
                    <p className="text-lg">Team Collaboration Illustration</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400">
          <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl font-bold text-white mb-6">
              Simplifying my business processes with Syspro has freed up time to focus on what matters most - business expansion.
            </h2>
            <p className="text-xl text-white/90 mb-8">
              Join thousands of businesses that trust Syspro for their operations.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="bg-white text-purple-600 px-8 py-4 rounded-full font-semibold hover:bg-gray-50 transition-all duration-200 inline-flex items-center gap-2 shadow-lg"
            >
              Start Today
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-2xl font-bold mb-4">Innovate with us</h3>
                <p className="text-gray-300 mb-6">
                  Ready to transform your business operations? Get started with Syspro today.
                </p>
                <button
                  onClick={() => router.push('/login')}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-full font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
                >
                  Start Today
                </button>
              </div>
              <div className="text-center md:text-right">
                <div className="text-gray-400 text-sm">
                  © 2026 Syspro. All rights reserved.
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return null;
}