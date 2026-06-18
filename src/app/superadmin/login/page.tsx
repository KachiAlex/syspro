'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Shield, Mail, Lock, Eye, EyeOff, AlertTriangle, Server, Database, Users, ChevronRight, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function SuperadminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/superadmin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        router.push('/superadmin');
      } else {
        const data = await response.json();
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">

      {/* Main Content */}
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          {/* Warning Banner */}
          <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 mb-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-yellow-500 mt-0.5" size={20} />
              <div>
                <h3 className="text-yellow-400 font-semibold mb-1">Restricted Access</h3>
                <p className="text-gray-400 text-sm">
                  This portal is for system administrators only. Unauthorized access attempts will be logged and reported.
                </p>
              </div>
            </div>
          </div>

          {/* Login Card */}
          <div className="bg-gray-800/50 backdrop-blur-lg border border-gray-700 rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600/20 rounded-full mb-4">
                <Shield className="text-red-500" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Super Admin Login
              </h2>
              <p className="text-gray-400">
                Enter your administrator credentials to access the system control panel
              </p>
            </div>

            <form className="w-full space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Administrator Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent focus:bg-gray-700/70"
                    placeholder="admin@syspro.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Administrator Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent focus:bg-gray-700/70"
                    placeholder="Enter administrator password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-400"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input type="checkbox" className="w-4 h-4 text-red-600 border-gray-600 rounded focus:ring-red-500 bg-gray-700" />
                  <span className="ml-2 text-sm text-gray-400">Remember this session</span>
                </label>
                <a href="#" className="text-sm text-red-400 hover:text-red-300">
                  Reset credentials
                </a>
              </div>

              {error && (
                <div className="text-red-400 text-sm text-center bg-red-900/20 border border-red-600/30 rounded-lg p-3">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                {loading ? 'Authenticating...' : 'Access Super Admin Panel'} <ArrowRight size={18} />
              </Button>
            </form>

            {/* Quick Access */}
            <div className="mt-8 pt-8 border-t border-gray-700">
              <p className="text-sm text-gray-400 mb-4">Quick Access:</p>
              <div className="space-y-2">
                <Link 
                  href="/superadmin"
                  className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors group"
                >
                  <span className="text-sm font-medium text-gray-300">
                    Super Admin Dashboard
                  </span>
                  <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-400" />
                </Link>
                <Link 
                  href="/superadmin/tenants"
                  className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors group"
                >
                  <span className="text-sm font-medium text-gray-300">
                    Tenant Management
                  </span>
                  <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-400" />
                </Link>
              </div>
            </div>
          </div>

          {/* System Info */}
          <div className="mt-8 grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
              <Server className="text-gray-400 mx-auto mb-2" size={24} />
              <div className="text-white font-semibold">System Status</div>
              <div className="text-green-400 text-sm">Operational</div>
            </div>
            <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
              <Database className="text-gray-400 mx-auto mb-2" size={24} />
              <div className="text-white font-semibold">Database</div>
              <div className="text-green-400 text-sm">Healthy</div>
            </div>
            <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
              <Users className="text-gray-400 mx-auto mb-2" size={24} />
              <div className="text-white font-semibold">Active Users</div>
              <div className="text-blue-400 text-sm">1,247</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}