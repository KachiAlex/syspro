'use client';

import React from 'react';
import { DashboardQuickAction } from '../../lib/types/shared';

interface QuickActionsProps {
  actions?: DashboardQuickAction[];
  isLoading?: boolean;
}

const iconMap: Record<string, JSX.Element> = {
  'user-plus': userPlusIcon(),
  'file-text': fileTextIcon(),
  package: packageIcon(),
  'chart-bar': chartBarIcon(),
};

export function QuickActions({ actions = [], isLoading }: QuickActionsProps) {
  const content = isLoading
    ? Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="flex flex-col items-center p-4 border border-gray-200 rounded-lg animate-pulse"
        >
          <div className="w-10 h-10 bg-gray-200 rounded mb-2" />
          <div className="h-3 w-20 bg-gray-200 rounded mb-1" />
          <div className="h-3 w-24 bg-gray-100 rounded" />
        </div>
      ))
    : actions.map((action) => (
        <a
          key={action.id}
          href={action.href}
          className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="mb-2 text-blue-500">{iconMap[action.icon] ?? defaultIcon()}</div>
          <span className="text-sm font-medium text-gray-900">{action.label}</span>
          <span className="text-xs text-gray-500 text-center mt-1">{action.description}</span>
        </a>
      ));

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">{content}</div>
      </div>
    </div>
  );
}

function defaultIcon() {
  return (
    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  );
}

function userPlusIcon() {
  return (
    <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v4m0 0v4m0-4h4m-4 0H8m-6 8v-1a4 4 0 014-4h4"
      />
    </svg>
  );
}

function fileTextIcon() {
  return (
    <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5l5 5v12a2 2 0 01-2 2z" />
    </svg>
  );
}

function packageIcon() {
  return (
    <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m8-4v14m-8-10l8 4 8-4m-8 4v10" />
    </svg>
  );
}

function chartBarIcon() {
  return (
    <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6a2 2 0 00-2-2H5v8m4 0h4V7a2 2 0 00-2-2h-2m6 12h4V9a2 2 0 00-2-2h-2" />
    </svg>
  );
}
