import React from 'react';
import './globals.css';
import { AuthProvider } from '../contexts/auth-context';
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
          <AuthProvider>
            {children}
          </AuthProvider>
          <EnvironmentStatus />
        </EnvironmentCheck>
      </body>
    </html>
  );
}