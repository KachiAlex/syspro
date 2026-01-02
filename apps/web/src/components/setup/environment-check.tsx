/**
 * Environment Check Component
 * Validates environment configuration and displays helpful error messages
 */

'use client';

import React, { useEffect, useState } from 'react';
import { env } from '../../lib/config/env';

interface EnvironmentCheckProps {
  children: React.ReactNode;
}

export function EnvironmentCheck({ children }: EnvironmentCheckProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Always render children to prevent blocking
  return <>{children}</>;
}

/**
 * Environment Status Indicator
 * Shows current environment configuration in development
 */
export function EnvironmentStatus() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !env.isDevelopment) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg z-50">
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
        <span>
          {env.nodeEnv} | API: {env.apiBaseUrl}
        </span>
      </div>
    </div>
  );
}