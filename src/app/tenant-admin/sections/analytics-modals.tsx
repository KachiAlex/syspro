"use client";

import React, { useState } from "react";
import { X, Download, AlertCircle } from "lucide-react";

// View Report Modal
export function ViewReportModal({
  isOpen,
  onClose,
  report,
  onDownload,
  onEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  report: {
    id: string;
    name: string;
    type: string;
    createdAt?: string;
    schedule?: string;
    rows?: number;
    dataPoints?: number;
  } | null;
  onDownload?: (format: string) => void;
  onEdit?: () => void;
}) {
  const [downloadFormat, setDownloadFormat] = useState("pdf");

  if (!isOpen || !report) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay">
      <div className="w-full max-w-md rounded-xl bg-theme-surface shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-theme-border px-6 py-4 sticky top-0 bg-theme-surface">
          <h2 className="text-lg font-semibold text-theme-text-primary">{report.name}</h2>
          <button onClick={onClose} className="text-theme-text-tertiary hover:text-theme-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 px-6 py-6">
          <div>
            <p className="text-xs font-medium text-theme-text-tertiary">Report Type</p>
            <p className="text-sm font-semibold text-theme-text-primary mt-1 capitalize">{report.type}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {report.createdAt && (
              <div>
                <p className="text-xs font-medium text-theme-text-tertiary">Created</p>
                <p className="text-sm text-theme-text-secondary mt-1">{new Date(report.createdAt).toLocaleDateString()}</p>
              </div>
            )}
            {report.dataPoints && (
              <div>
                <p className="text-xs font-medium text-theme-text-tertiary">Data Points</p>
                <p className="text-sm text-theme-text-secondary mt-1">{report.dataPoints.toLocaleString()}</p>
              </div>
            )}
          </div>

          {report.rows && (
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xs font-medium text-theme-text-primary">Report includes {report.rows} rows of data</p>
            </div>
          )}

          {/* Download Section */}
          <div>
            <p className="text-xs font-medium text-theme-text-tertiary mb-2">Download Report</p>
            <select
              value={downloadFormat}
              onChange={(e) => setDownloadFormat(e.target.value)}
              className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
            >
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
            <button
              onClick={() => onDownload?.(downloadFormat)}
              className="w-full rounded-lg bg-theme-accent px-4 py-2 text-sm font-medium text-theme-text-primary hover:bg-theme-accent-hover flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download as {downloadFormat.toUpperCase()}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-theme-border px-6 py-4 flex gap-3 sticky bottom-0 bg-theme-surface">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex-1 rounded-lg bg-theme-muted px-4 py-2 text-sm font-medium text-theme-text-primary hover:bg-theme-elevated"
            >
              Edit
            </button>
          )}
          <button
            onClick={onClose}
            className={`${onEdit ? "flex-1" : "w-full"} rounded-lg bg-theme-muted px-4 py-2 text-sm font-medium text-theme-text-primary hover:bg-theme-elevated`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Edit Report Modal
export function EditReportModal({
  isOpen,
  onClose,
  onSave,
  report,
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: { name?: string; schedule?: string }) => void;
  report: { id: string; name: string; schedule?: string } | null;
  isLoading?: boolean;
}) {
  const [name, setName] = useState(report?.name ?? "");
  const [schedule, setSchedule] = useState(report?.schedule ?? "never");
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (report) {
      setName(report.name);
      setSchedule(report.schedule ?? "never");
    }
  }, [report, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Report name is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;
    onSave({ name, schedule });
  };

  if (!isOpen || !report) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay">
      <div className="w-full max-w-md rounded-xl bg-theme-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-theme-border px-6 py-4">
          <h2 className="text-lg font-semibold text-theme-text-primary">Edit Report</h2>
          <button onClick={onClose} className="text-theme-text-tertiary hover:text-theme-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-6">
          <div>
            <label htmlFor="reportName" className="block text-sm font-medium text-theme-text-primary mb-2">
              Report Name
            </label>
            <input
              id="reportName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q4 Sales Analysis"
              className={`bg-theme-surface w-full rounded-lg border px-3 py-2 text-sm ${ errors.name ? "border-rose-300 bg-rose-50" : "border-theme-border" }`}
            />
            {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="schedule" className="block text-sm font-medium text-theme-text-primary mb-2">
              Auto-Generate Schedule
            </label>
            <select
              id="schedule"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="bg-theme-surface w-full rounded-lg border border-theme-border px-3 py-2 text-sm"
            >
              <option value="never">Never</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <p className="text-xs text-theme-text-tertiary mt-1">Reports will be automatically regenerated on this schedule</p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-theme-border px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-theme-muted px-4 py-2 text-sm font-medium text-theme-text-primary hover:bg-theme-elevated disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-theme-accent px-4 py-2 text-sm font-medium text-theme-text-primary hover:bg-theme-accent-hover disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Run Export Now Modal
export function RunExportNowModal({
  isOpen,
  onClose,
  onRun,
  exportJob,
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onRun: (format?: string) => void;
  exportJob: { id: string; name: string; format: string } | null;
  isLoading?: boolean;
}) {
  const [selectedFormat, setSelectedFormat] = useState<string>("");

  React.useEffect(() => {
    if (exportJob) {
      setSelectedFormat(exportJob.format || "csv");
    }
  }, [exportJob, isOpen]);

  if (!isOpen || !exportJob) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay">
      <div className="w-full max-w-md rounded-xl bg-theme-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-theme-border px-6 py-4">
          <h2 className="text-lg font-semibold text-theme-text-primary">Run Export Now</h2>
          <button onClick={onClose} className="text-theme-text-tertiary hover:text-theme-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-6">
          <p className="text-sm text-theme-text-secondary">
            Run the <strong>{exportJob.name}</strong> export now?
          </p>

          <div>
            <label htmlFor="exportFormat" className="block text-sm font-medium text-theme-text-primary mb-2">
              Export Format
            </label>
            <select
              id="exportFormat"
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="bg-theme-surface w-full rounded-lg border border-theme-border px-3 py-2 text-sm"
            >
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
              <option value="json">JSON</option>
            </select>
          </div>

          <div className="rounded-lg bg-blue-50 p-3 text-xs text-theme-text-primary">
            The export will be sent to your configured delivery channels (Email, Webhook, etc.)
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-theme-border px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-theme-muted px-4 py-2 text-sm font-medium text-theme-text-primary hover:bg-theme-elevated disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onRun(selectedFormat)}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-theme-accent px-4 py-2 text-sm font-medium text-theme-text-primary hover:bg-theme-accent-hover disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Running...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Run Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Edit Export Modal
export function EditExportModal({
  isOpen,
  onClose,
  onSave,
  exportJob,
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: { name?: string; frequency?: string; format?: string }) => void;
  exportJob: { id: string; name: string; frequency: string; format: string } | null;
  isLoading?: boolean;
}) {
  const [name, setName] = useState(exportJob?.name ?? "");
  const [frequency, setFrequency] = useState(exportJob?.frequency ?? "daily");
  const [format, setFormat] = useState(exportJob?.format ?? "csv");
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (exportJob) {
      setName(exportJob.name);
      setFrequency(exportJob.frequency);
      setFormat(exportJob.format);
    }
  }, [exportJob, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Export name is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;
    onSave({ name, frequency, format });
  };

  if (!isOpen || !exportJob) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay">
      <div className="w-full max-w-md rounded-xl bg-theme-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-theme-border px-6 py-4">
          <h2 className="text-lg font-semibold text-theme-text-primary">Edit Export</h2>
          <button onClick={onClose} className="text-theme-text-tertiary hover:text-theme-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-6">
          <div>
            <label htmlFor="exportName" className="block text-sm font-medium text-theme-text-primary mb-2">
              Export Name
            </label>
            <input
              id="exportName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Daily Sales Export"
              className={`bg-theme-surface w-full rounded-lg border px-3 py-2 text-sm ${ errors.name ? "border-rose-300 bg-rose-50" : "border-theme-border" }`}
            />
            {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="frequency" className="block text-sm font-medium text-theme-text-primary mb-2">
                Frequency
              </label>
              <select
                id="frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="bg-theme-surface w-full rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text-primary"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label htmlFor="format" className="block text-sm font-medium text-theme-text-primary mb-2">
                Format
              </label>
              <select
                id="format"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="bg-theme-surface w-full rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text-primary"
              >
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
                <option value="pdf">PDF</option>
                <option value="json">JSON</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-theme-border px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-theme-muted px-4 py-2 text-sm font-medium text-theme-text-primary hover:bg-theme-elevated disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-theme-accent px-4 py-2 text-sm font-medium text-theme-text-primary hover:bg-theme-accent-hover disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
