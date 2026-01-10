import React from 'react';
import './globals.css';
import { AuthProvider } from '../contexts/auth-context';
import { QueryProvider } from '../providers/query-provider';
import { EnvironmentCheck, EnvironmentStatus } from '../components/setup/environment-check';

export const metadata = {
  title: 'Syspro ERP - Multi-Tenant Business Management',
  description: 'Production-ready multi-tenant ERP system built with NestJS, React, and PostgreSQL',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <EnvironmentCheck>
          <QueryProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
            <EnvironmentStatus />
          </QueryProvider>
        </EnvironmentCheck>
      </body>
    </html>
  );
}