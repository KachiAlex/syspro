/**
 * Audit Trail Component
 * Displays complete history of expense changes
 */

"use client";

import { Fragment } from "react";
import { Clock, CheckCircle2, XCircle, AlertCircle, FileText } from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  timestamp: string;
  user: string;
  details: Record<string, any>;
}

interface AuditTrailProps {
  entries: AuditEntry[];
  isLoading?: boolean;
  emptyMessage?: string;
}

/**
 * Format action type for display
 */
function getActionIcon(action: string) {
  const icons: Record<string, typeof CheckCircle2> = {
    created: FileText,
    submitted: FileText,
    approved: CheckCircle2,
    rejected: XCircle,
    clarification_requested: AlertCircle,
    updated: FileText,
    paid: CheckCircle2,
    posted_to_gl: FileText,
    marked_paid: CheckCircle2,
  };

  return icons[action] || FileText;
}

/**
 * Format action type for display
 */
function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    created: "Expense Created",
    submitted: "Submitted for Approval",
    approved: "Approved",
    rejected: "Rejected",
    clarification_requested: "Clarification Requested",
    updated: "Updated",
    paid: "Marked as Paid",
    posted_to_gl: "Posted to General Ledger",
    marked_paid: "Payment Recorded",
  };

  return labels[action] || action;
}

/**
 * Get status color based on action
 */
function getStatusColor(action: string): string {
  switch (action) {
    case "approved":
    case "paid":
    case "marked_paid":
    case "posted_to_gl":
      return "text-green-600 bg-green-50";
    case "rejected":
    case "clarification_requested":
      return "text-amber-600 bg-amber-50";
    case "created":
    case "submitted":
    case "updated":
      return "text-theme-accent bg-blue-50";
    default:
      return "text-theme-text-secondary bg-theme-muted";
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // Within last minute
  if (diff < 60000) {
    return "Just now";
  }

  // Within last hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  }

  // Within last day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  }

  // Format as date
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format details for display
 */
function formatDetails(details: Record<string, any>): string {
  const parts: string[] = [];

  if (details.reason) {
    parts.push(`Reason: ${details.reason}`);
  }

  if (details.amount) {
    parts.push(`Amount: ₦${(details.amount / 1000000).toFixed(2)}M`);
  }

  if (details.journalEntryId) {
    parts.push(`JE: ${details.journalEntryId}`);
  }

  if (details.linkedPaymentId) {
    parts.push(`Payment: ${details.linkedPaymentId}`);
  }

  return parts.length > 0 ? parts.join(" • ") : "";
}

/**
 * Audit Trail Component
 */
export default function AuditTrail({
  entries,
  isLoading = false,
  emptyMessage = "No audit history available",
}: AuditTrailProps) {
  // Sort entries by timestamp (newest first)
  const sortedEntries = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin">
          <Clock className="h-6 w-6 text-theme-accent" />
        </div>
        <p className="ml-2 text-theme-text-secondary">Loading audit trail...</p>
      </div>
    );
  }

  if (sortedEntries.length === 0) {
    return (
      <div className="rounded-lg border border-theme-border bg-theme-muted p-6 text-center">
        <Clock className="mx-auto h-8 w-8 text-theme-text-secondary" />
        <p className="mt-2 text-sm text-theme-text-secondary">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Timeline */}
      <div className="relative">
        {sortedEntries.map((entry, index) => {
          const IconComponent = getActionIcon(entry.action);
          const statusColor = getStatusColor(entry.action);

          return (
            <Fragment key={entry.id}>
              <div className="flex gap-4">
                {/* Timeline dot and line */}
                <div className="relative flex flex-col items-center">
                  <div
                    className={`rounded-full p-2 ${statusColor}`}
                  >
                    <IconComponent className="h-4 w-4" />
                  </div>
                  {index < sortedEntries.length - 1 && (
                    <div className="absolute top-10 h-12 w-0.5 bg-theme-muted" />
                  )}
                </div>

                {/* Timeline content */}
                <div className="flex-1 pb-8">
                  <div className="rounded-lg border border-theme-border bg-theme-surface p-4">
                    {/* Action and timestamp */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-theme-text-primary">
                          {getActionLabel(entry.action)}
                        </p>
                        <p className="text-sm text-theme-text-secondary">
                          by {entry.user || "System"}
                        </p>
                      </div>
                      <p className="text-xs text-theme-text-tertiary">
                        {formatTimestamp(entry.timestamp)}
                      </p>
                    </div>

                    {/* Details if available */}
                    {Object.keys(entry.details).length > 0 && (
                      <div className="mt-3 rounded bg-theme-muted p-2">
                        <p className="text-xs text-theme-text-primary">
                          {formatDetails(entry.details)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Compact Audit Trail (inline version)
 */
export function CompactAuditTrail({ entries }: { entries: AuditEntry[] }) {
  const latestEntries = [...entries]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-theme-text-secondary">
        Recent Activity
      </p>
      {latestEntries.map((entry) => {
        const IconComponent = getActionIcon(entry.action);
        return (
          <div key={entry.id} className="flex items-center gap-2">
            <IconComponent className="h-3 w-3 text-theme-text-tertiary" />
            <span className="text-xs text-theme-text-secondary">
              {getActionLabel(entry.action)}
            </span>
            <span className="text-xs text-theme-text-secondary">
              {formatTimestamp(entry.timestamp)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Audit Trail Badge (for quick status indicator)
 */
export function AuditTrailBadge({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return null;

  const latest = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];

  const statusColor = getStatusColor(latest.action);

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${statusColor}`}>
      <Clock className="h-3 w-3" />
      {getActionLabel(latest.action)}
    </span>
  );
}
