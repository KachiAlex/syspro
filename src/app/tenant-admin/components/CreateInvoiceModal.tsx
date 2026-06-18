"use client";

import React, { useState } from "react";
import { X, AlertCircle, CheckCircle, Plus, Trash2 } from "lucide-react";

interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (invoiceData: any) => Promise<void>;
}

const initialLineItem: InvoiceLineItem = {
  id: Date.now().toString(),
  description: "",
  quantity: 1,
  unitPrice: 0,
  taxRate: 0,
};

export default function CreateInvoiceModal({
  isOpen,
  onClose,
  onSubmit,
}: CreateInvoiceModalProps) {
  const [formData, setFormData] = useState({
    customerName: "",
    customerCode: "",
    invoiceNumber: "",
    purchaseOrder: "",
    issuedDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    currency: "₦",
    status: "draft",
    paymentTerms: "Net 30",
    notes: "",
    tags: "",
  });

  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    initialLineItem,
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const calculateLineItemAmount = (item: InvoiceLineItem): number => {
    const subtotal = item.quantity * item.unitPrice;
    const tax = item.taxRate ? (subtotal * item.taxRate) / 100 : 0;
    return subtotal + tax;
  };

  const calculateTotal = (): number => {
    return lineItems.reduce((sum, item) => sum + calculateLineItemAmount(item), 0);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.customerName.trim()) {
      newErrors.customerName = "Customer name is required";
    }
    if (!formData.invoiceNumber.trim()) {
      newErrors.invoiceNumber = "Invoice number is required";
    }
    if (!formData.issuedDate) {
      newErrors.issuedDate = "Issued date is required";
    }
    if (!formData.dueDate) {
      newErrors.dueDate = "Due date is required";
    }

    if (lineItems.length === 0) {
      newErrors.lineItems = "At least one line item is required";
    } else {
      const invalidItems = lineItems.filter(
        (item) =>
          !item.description.trim() || item.quantity <= 0 || item.unitPrice <= 0
      );
      if (invalidItems.length > 0) {
        newErrors.lineItems =
          "All line items must have description, quantity, and unit price";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleLineItemChange = (
    id: string,
    field: keyof InvoiceLineItem,
    value: any
  ) => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]:
                field === "description"
                  ? value
                  : field === "quantity"
                  ? Math.max(0, parseFloat(value) || 0)
                  : Math.max(0, parseFloat(value) || 0),
            }
          : item
      )
    );
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        ...initialLineItem,
        id: Date.now().toString(),
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const invoiceData = {
        ...formData,
        amount: calculateTotal(),
        balanceDue: calculateTotal(),
        lineItems: lineItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          amount: calculateLineItemAmount(item),
        })),
        tags: formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag),
      };

      await onSubmit(invoiceData);
      setSuccessMessage("Invoice created successfully!");
      setTimeout(() => {
        setFormData({
          customerName: "",
          customerCode: "",
          invoiceNumber: "",
          purchaseOrder: "",
          issuedDate: new Date().toISOString().split("T")[0],
          dueDate: "",
          currency: "₦",
          status: "draft",
          paymentTerms: "Net 30",
          notes: "",
          tags: "",
        });
        setLineItems([initialLineItem]);
        setSuccessMessage("");
        onClose();
      }, 1500);
    } catch (error: any) {
      setErrors({
        submit: error?.message || "Failed to create invoice",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const total = calculateTotal();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] pointer-events-auto" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto z-[10000] relative">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">Create Invoice</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition"
            disabled={isSubmitting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="m-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium text-green-800">{successMessage}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Error Message */}
          {errors.submit && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-sm font-medium text-red-800">{errors.submit}</p>
            </div>
          )}

          {/* Customer Information */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Customer Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleInputChange}
                  placeholder="Acme Corporation"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    errors.customerName
                      ? "border-red-300 focus:ring-red-500"
                      : "border-gray-300 focus:ring-blue-500"
                  }`}
                  disabled={isSubmitting}
                />
                {errors.customerName && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.customerName}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Customer Code
                </label>
                <input
                  type="text"
                  name="customerCode"
                  value={formData.customerCode}
                  onChange={handleInputChange}
                  placeholder="CUST-001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Invoice Details
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Invoice Number *
                </label>
                <input
                  type="text"
                  name="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={handleInputChange}
                  placeholder="INV-2024-001"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    errors.invoiceNumber
                      ? "border-red-300 focus:ring-red-500"
                      : "border-gray-300 focus:ring-blue-500"
                  }`}
                  disabled={isSubmitting}
                />
                {errors.invoiceNumber && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.invoiceNumber}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Purchase Order
                </label>
                <input
                  type="text"
                  name="purchaseOrder"
                  value={formData.purchaseOrder}
                  onChange={handleInputChange}
                  placeholder="PO-12345"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Issued Date *
                </label>
                <input
                  type="date"
                  name="issuedDate"
                  value={formData.issuedDate}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    errors.issuedDate
                      ? "border-red-300 focus:ring-red-500"
                      : "border-gray-300 focus:ring-blue-500"
                  }`}
                  disabled={isSubmitting}
                />
                {errors.issuedDate && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.issuedDate}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Due Date *
                </label>
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    errors.dueDate
                      ? "border-red-300 focus:ring-red-500"
                      : "border-gray-300 focus:ring-blue-500"
                  }`}
                  disabled={isSubmitting}
                />
                {errors.dueDate && (
                  <p className="text-xs text-red-600 mt-1">{errors.dueDate}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Currency
                </label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                  disabled={isSubmitting}
                >
                  <option value="₦">Nigerian Naira (₦)</option>
                  <option value="$">US Dollar ($)</option>
                  <option value="€">Euro (€)</option>
                  <option value="£">British Pound (£)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                  disabled={isSubmitting}
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Line Items
            </h3>
            {errors.lineItems && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <p className="text-sm text-red-800">{errors.lineItems}</p>
              </div>
            )}
            <div className="overflow-x-auto border border-gray-200 rounded-lg mb-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-900">
                      Description
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-900">
                      Qty
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-900">
                      Unit Price
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-900">
                      Tax %
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-900">
                      Amount
                    </th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-900">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => (
                    <tr key={item.id} className="border-t border-gray-200">
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) =>
                            handleLineItemChange(item.id, "description", e.target.value)
                          }
                          placeholder="Service or item description"
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          disabled={isSubmitting}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleLineItemChange(item.id, "quantity", e.target.value)
                          }
                          min="0"
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                          disabled={isSubmitting}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleLineItemChange(item.id, "unitPrice", e.target.value)
                          }
                          min="0"
                          step="0.01"
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                          disabled={isSubmitting}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.taxRate || 0}
                          onChange={(e) =>
                            handleLineItemChange(item.id, "taxRate", e.target.value)
                          }
                          min="0"
                          max="100"
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                          disabled={isSubmitting}
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formData.currency}{" "}
                        {calculateLineItemAmount(item).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeLineItem(item.id)}
                          disabled={lineItems.length === 1 || isSubmitting}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={addLineItem}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Add Line Item
            </button>
          </div>

          {/* Summary */}
          <div className="mb-6 pb-6 border-b border-gray-200 flex justify-end">
            <div className="w-full md:w-64">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium text-gray-900">
                  {formData.currency}{" "}
                  {lineItems
                    .reduce(
                      (sum, item) =>
                        sum + item.quantity * item.unitPrice,
                      0
                    )
                    .toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between mb-3">
                <span className="text-gray-600">Tax:</span>
                <span className="font-medium text-gray-900">
                  {formData.currency}{" "}
                  {lineItems
                    .reduce(
                      (sum, item) => {
                        const subtotal = item.quantity * item.unitPrice;
                        const tax = item.taxRate
                          ? (subtotal * item.taxRate) / 100
                          : 0;
                        return sum + tax;
                      },
                      0
                    )
                    .toFixed(2)}
                </span>
              </div>
              <div className="border-t border-gray-300 pt-3 flex justify-between">
                <span className="font-semibold text-gray-900">Total:</span>
                <span className="text-lg font-bold text-blue-600">
                  {formData.currency} {total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Additional Details */}
          <div className="mb-6">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Payment Terms
                </label>
                <input
                  type="text"
                  name="paymentTerms"
                  value={formData.paymentTerms}
                  onChange={handleInputChange}
                  placeholder="Net 30"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  name="tags"
                  value={formData.tags}
                  onChange={handleInputChange}
                  placeholder="urgent, client1, project-x"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Add any additional notes or payment instructions..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
