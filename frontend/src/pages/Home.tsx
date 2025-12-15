import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-indigo-600">Syspro ERP</h1>
            </div>
            <div>
              <Button onClick={() => navigate('/login')} variant="default">
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-extrabold text-gray-900 mb-6">
            Welcome to Syspro ERP
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Multi-tenant Enterprise Resource Planning system for Syscomptech & Subsidiaries.
            Streamline your business operations with our comprehensive ERP solution.
          </p>
          <div className="flex justify-center gap-4">
            <Button onClick={() => navigate('/login')} size="lg">
              Get Started
            </Button>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Multi-Tenant Architecture</h3>
            <p className="text-gray-600">
              Securely manage multiple organizations with isolated data and customizable configurations.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Role-Based Access Control</h3>
            <p className="text-gray-600">
              Fine-grained permissions and role management to ensure data security and compliance.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Comprehensive Billing</h3>
            <p className="text-gray-600">
              Integrated billing and subscription management with multiple payment gateway support.
            </p>
          </div>
        </div>
      </main>

      <footer className="bg-white mt-20 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-500">
            © 2024 Syscomptech. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;

