"use client";

import React from "react";
import { FolderOpen } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({
  title = "No data available",
  description = "There's nothing to display here yet.",
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-xl bg-[rgba(227,30,36,0.1)] flex items-center justify-center mb-4">
        {icon || <FolderOpen className="w-7 h-7 text-[#E8286E]" />}
      </div>
      <h3 className="text-base font-semibold text-[#F8FAFC] mb-1">{title}</h3>
      <p className="text-sm text-[#94A3B8] max-w-sm mb-5">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
