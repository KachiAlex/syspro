'use client';

import React from 'react';

export default function AutomationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      {children}
    </div>
  );
}
