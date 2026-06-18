"use client";

import React, { useState, useRef } from "react";
import { X, AlertCircle, Zap, Send, Check, Upload, FileText } from "lucide-react";

function formatAmountDisplay(value: string): string {
  const num = value.replace(/[^0-9.]/g, "");
  const parts = num.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

function parseAmountValue(formatted: string): string {
  return formatted.replace(/,/g, "");
}

const CATEGORY_GROUPS = [
  {
    group: "Office & Operations",
    options: [
      { value: "cat_supplies", label: "Office Supplies" },
      { value: "cat_rent", label: "Rent & Lease" },
      { value: "cat_utilities", label: "Utilities (Electricity, Water, Gas)" },
      { value: "cat_internet", label: "Internet & Telecommunications" },
      { value: "cat_maintenance", label: "Repairs & Maintenance" },
      { value: "cat_cleaning", label: "Cleaning & Janitorial" },
      { value: "cat_security", label: "Security Services" },
      { value: "cat_furniture", label: "Furniture & Equipment" },
      { value: "cat_printing", label: "Printing & Stationery" },
    ],
  },
  {
    group: "Travel & Transport",
    options: [
      { value: "cat_travel", label: "Travel" },
      { value: "cat_transport", label: "Transportation & Logistics" },
      { value: "cat_fuel", label: "Fuel & Vehicle Expenses" },
      { value: "cat_accommodation", label: "Accommodation & Lodging" },
      { value: "cat_meals", label: "Meals & Entertainment" },
    ],
  },
  {
    group: "Technology & Software",
    options: [
      { value: "cat_software", label: "Software & Subscriptions" },
      { value: "cat_hardware", label: "Computer Hardware & Devices" },
      { value: "cat_cloud", label: "Cloud Services & Hosting" },
      { value: "cat_it_support", label: "IT Support & Services" },
    ],
  },
  {
    group: "HR & People",
    options: [
      { value: "cat_training", label: "Training & Development" },
      { value: "cat_recruitment", label: "Recruitment & Hiring" },
      { value: "cat_benefits", label: "Employee Benefits & Welfare" },
      { value: "cat_relocation", label: "Relocation & Moving" },
      { value: "cat_conferences", label: "Conferences & Events" },
    ],
  },
  {
    group: "Professional & Legal",
    options: [
      { value: "cat_professional", label: "Professional Services" },
      { value: "cat_legal", label: "Legal Fees" },
      { value: "cat_accounting", label: "Accounting & Audit Fees" },
      { value: "cat_consulting", label: "Consulting Fees" },
      { value: "cat_licenses", label: "Licenses & Permits" },
    ],
  },
  {
    group: "Marketing & Sales",
    options: [
      { value: "cat_advertising", label: "Advertising & Promotions" },
      { value: "cat_marketing", label: "Marketing & Branding" },
      { value: "cat_client_gifts", label: "Client Gifts & Entertainment" },
      { value: "cat_sponsorship", label: "Sponsorship & Donations" },
    ],
  },
  {
    group: "Insurance & Compliance",
    options: [
      { value: "cat_insurance", label: "Insurance" },
      { value: "cat_taxes", label: "Taxes & Government Levies" },
      { value: "cat_compliance", label: "Regulatory & Compliance Fees" },
    ],
  },
  {
    group: "Finance & Banking",
    options: [
      { value: "cat_bank_charges", label: "Bank Charges & Fees" },
      { value: "cat_interest", label: "Interest & Loan Repayment" },
      { value: "cat_subscriptions", label: "Subscriptions & Memberships" },
    ],
  },
  {
    group: "Miscellaneous",
    options: [
      { value: "cat_shipping", label: "Shipping & Courier" },
      { value: "cat_waste", label: "Waste Disposal & Recycling" },
      { value: "cat_petty_cash", label: "Petty Cash" },
      { value: "cat_other", label: "Other" },
    ],
  },
];

const ALL_CATEGORY_OPTIONS = CATEGORY_GROUPS.flatMap((g) => g.options);

// Submit Expense Modal
export function SubmitExpenseModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  tenantSlug = "default",
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  isLoading?: boolean;
  tenantSlug?: string;
}) {
  const [formData, setFormData] = useState({
    category: "cat_supplies",
    otherCategoryDetail: "",
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    receipt: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const rawAmount = parseAmountValue(formData.amount);
    if (!rawAmount || parseFloat(rawAmount) <= 0) newErrors.amount = "Amount must be greater than 0";
    if (!formData.description.trim()) newErrors.description = "Description is required";
    if (!formData.date) newErrors.date = "Date is required";
    if (formData.category === "cat_other" && !formData.otherCategoryDetail.trim()) {
      newErrors.otherCategoryDetail = "Please specify the expense category";
    }
    if (formData.receipt && !receiptFile) {
      newErrors.receipt = "Please attach a receipt file";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, "");
    const formatted = formatAmountDisplay(raw);
    setFormData({ ...formData, amount: formatted });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setReceiptFile(file);
    if (file) {
      setErrors((prev) => ({ ...prev, receipt: "" }));
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const rawAmount = parseFloat(parseAmountValue(formData.amount));
      const categoryName = formData.category === "cat_other"
        ? formData.otherCategoryDetail
        : ALL_CATEGORY_OPTIONS.find((c) => c.value === formData.category)?.label ?? formData.category;

      const response = await fetch('/api/finance/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          type: "reimbursement",
          amount: rawAmount,
          taxType: "NONE",
          category: categoryName,
          categoryId: formData.category,
          description: formData.description,
          date: formData.date,
          approvalStatus: "PENDING",
          paymentStatus: "UNPAID",
          createdBy: "current-user",
          notes: formData.category === "cat_other" ? `Other: ${formData.otherCategoryDetail}` : undefined,
          attachments: [],
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.details || errBody?.error || 'Failed to submit expense');
      }

      const result = await response.json();
      const expense = result.expense;

      // Upload receipt if attached
      if (formData.receipt && receiptFile && expense?.id) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(receiptFile);
        });

        await fetch('/api/finance/expenses/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expenseId: expense.id,
            filename: receiptFile.name,
            mimeType: receiptFile.type,
            data: base64,
          }),
        });
      }

      await onSubmit(expense);
      setFormData({ category: "cat_supplies", otherCategoryDetail: "", amount: "", description: "", date: new Date().toISOString().split("T")[0], receipt: false });
      setReceiptFile(null);
    } catch (err) {
      console.error('Expense submission error:', err);
      setSubmitError(err instanceof Error ? err.message : "Failed to submit expense");
    } finally {
      setSubmitting(false);
    }
  };

  const loading = isLoading || submitting;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-black">Submit Expense</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-theme-text-tertiary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-6">
          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-black mb-2">
              Category
            </label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value, otherCategoryDetail: "" })}
              className="w-full rounded-lg border border-slate-200 bg-white text-black px-3 py-2 text-sm"
              disabled={loading}
            >
              {CATEGORY_GROUPS.map((grp) => (
                <optgroup key={grp.group} label={grp.group}>
                  {grp.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {formData.category === "cat_other" && (
            <div>
              <label htmlFor="otherCategoryDetail" className="block text-sm font-medium text-black mb-2">
                Specify Category
              </label>
              <input
                id="otherCategoryDetail"
                type="text"
                value={formData.otherCategoryDetail}
                onChange={(e) => setFormData({ ...formData, otherCategoryDetail: e.target.value })}
                placeholder="Enter expense category details..."
                className={`w-full rounded-lg border px-3 py-2 text-sm bg-white text-black ${ errors.otherCategoryDetail ? "border-red-300 bg-red-50" : "border-slate-200 bg-white" }`}
                disabled={loading}
              />
              {errors.otherCategoryDetail && <p className="text-xs text-red-600 mt-1">{errors.otherCategoryDetail}</p>}
            </div>
          )}

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-black mb-2">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">₦</span>
              <input
                id="amount"
                type="text"
                inputMode="decimal"
                value={formData.amount}
                onChange={handleAmountChange}
                placeholder="0"
                className={`w-full rounded-lg border pl-7 pr-3 py-2 text-sm bg-white text-black ${ errors.amount ? "border-red-300 bg-red-50" : "border-slate-200" }`}
                disabled={loading}
              />
            </div>
            {errors.amount && <p className="text-xs text-red-600 mt-1">{errors.amount}</p>}
          </div>

          <div>
            <label htmlFor="date" className="block text-sm font-medium text-black mb-2">
              Date
            </label>
            <input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className={`w-full rounded-lg border px-3 py-2 text-sm bg-white text-black ${ errors.date ? "border-red-300 bg-red-50" : "border-slate-200" }`}
              disabled={loading}
            />
            {errors.date && <p className="text-xs text-red-600 mt-1">{errors.date}</p>}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-black mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What was this expense for?"
              rows={3}
              className={`w-full rounded-lg border px-3 py-2 text-sm bg-white text-black ${ errors.description ? "border-red-300 bg-red-50" : "border-slate-200" }`}
              disabled={loading}
            />
            {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description}</p>}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                id="receipt"
                type="checkbox"
                checked={formData.receipt}
                onChange={(e) => {
                  setFormData({ ...formData, receipt: e.target.checked });
                  if (!e.target.checked) setReceiptFile(null);
                }}
                className="bg-white rounded border-slate-200 text-black"
                disabled={loading}
              />
              <label htmlFor="receipt" className="text-sm text-theme-text-tertiary">
                I have a receipt attached
              </label>
            </div>

            {formData.receipt && (
              <div className="pl-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileChange}
                  className="bg-white hidden text-black"
                />
                {!receiptFile ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-sm transition ${
                      errors.receipt ? "border-red-300 bg-red-50 text-red-600" : "border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-theme-text-tertiary"
                    }`}
                    disabled={loading}
                  >
                    <Upload className="w-4 h-4" />
                    Click to upload receipt
                  </button>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-gray-100 px-3 py-2">
                    <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-sm text-theme-text-tertiary truncate flex-1">{receiptFile.name}</span>
                    <button
                      type="button"
                      onClick={() => { setReceiptFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="text-gray-500 hover:text-red-600 flex-shrink-0"
                      disabled={loading}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {errors.receipt && <p className="text-xs text-red-600 mt-1">{errors.receipt}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 flex gap-3 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-black hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Expense
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// View Expense Details Modal
export function ViewExpenseModal({
  isOpen,
  onClose,
  expense,
  onApprove,
  onReject,
  onEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  expense: {
    id: string;
    category: string;
    amount: number;
    status: string;
    description: string;
    employee?: string;
    submittedDate?: string;
    notes?: string;
  } | null;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
}) {
  if (!isOpen || !expense) return null;

  const statusColor: Record<string, string> = {
    approved: "bg-green-50 text-green-600",
    rejected: "bg-red-50 text-red-600",
    pending: "bg-amber-50 text-amber-600",
    reimbursed: "bg-blue-50 text-blue-600",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-black">Expense #{expense.id}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-theme-text-tertiary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 px-6 py-6">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Status</span>
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusColor[expense.status.toLowerCase()] || "bg-gray-100 text-theme-text-tertiary"}`}>
                {expense.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500">Category</p>
              <p className="text-sm font-semibold text-black mt-1 capitalize">{expense.category}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Amount</p>
              <p className="text-sm font-semibold text-black mt-1">₦{expense.amount.toLocaleString()}</p>
            </div>
          </div>

          {expense.employee && (
            <div>
              <p className="text-xs font-medium text-gray-500">Employee</p>
              <p className="text-sm text-theme-text-tertiary mt-1">{expense.employee}</p>
            </div>
          )}

          {expense.submittedDate && (
            <div>
              <p className="text-xs font-medium text-gray-500">Submitted</p>
              <p className="text-sm text-theme-text-tertiary mt-1">{new Date(expense.submittedDate).toLocaleDateString()}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-gray-500">Description</p>
            <p className="text-sm text-theme-text-tertiary mt-1">{expense.description}</p>
          </div>

          {expense.notes && (
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xs font-medium text-black">Approver Notes</p>
              <p className="text-sm text-blue-600 mt-1">{expense.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 space-y-3 sticky bottom-0 bg-white">
          {expense.status === "pending" && (
            <div className="flex gap-2">
              <button
                onClick={onReject}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-gray-100"
              >
                Reject
              </button>
              <button
                onClick={onApprove}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-gray-100"
              >
                <Check className="w-4 h-4" />
                Approve
              </button>
            </div>
          )}
          {onEdit && expense.status === "draft" && (
            <button
              onClick={onEdit}
              className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-black hover:bg-gray-100"
            >
              Edit
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-black hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Bulk Actions Modal
export function BulkActionsModal({
  isOpen,
  onClose,
  onApproveAll,
  onRejectAll,
  count = 0,
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onApproveAll: () => void;
  onRejectAll: () => void;
  count?: number;
  isLoading?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-black">Bulk Actions</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-theme-text-tertiary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-6">
          <p className="text-sm text-theme-text-tertiary">
            You have selected <strong>{count}</strong> expense{count !== 1 ? "s" : ""}. Choose an action:
          </p>

          <div className="rounded-lg bg-blue-50 p-3 text-sm text-black">
            <p className="font-medium">Bulk operations will:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
              <li>Apply the same action to all selected expenses</li>
              <li>Send notifications to submitters</li>
              <li>Update approval workflow status</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onRejectAll}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {isLoading ? "Processing..." : "Reject All"}
          </button>
          <button
            onClick={onApproveAll}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-black hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading ? "Processing..." : "Approve All"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Export Expenses Modal
export function ExportExpensesModal({
  isOpen,
  onClose,
  onExport,
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: string) => void;
  isLoading?: boolean;
}) {
  const [format, setFormat] = useState("csv");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-black">Export Expenses</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-theme-text-tertiary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-6">
          <div>
            <label htmlFor="format" className="block text-sm font-medium text-black mb-2">
              Format
            </label>
            <select
              id="format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white text-black px-3 py-2 text-sm"
            >
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
            </select>
          </div>

          <div className="rounded-lg bg-blue-50 p-3 text-sm text-black">
            <p className="font-medium">The export will include:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
              <li>All selected expenses</li>
              <li>Category, amount, status</li>
              <li>Employee and submission date</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-black hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onExport(format)}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-black hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
