"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";

interface BillItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  lineAmount: number;
  accountCode?: string;
}

interface Bill {
  id: string;
  billNumber: string;
  vendorId: string;
  poId?: string;
  billDate: string;
  dueDate?: string;
  currency: string;
  subtotal: number;
  taxes: number;
  total: number;
  balanceDue: number;
  status: "draft" | "open" | "partially_paid" | "paid" | "overdue" | "cancelled";
  items: BillItem[];
}

interface BillDrawerProps {
  bill: Bill | null;
  onClose: () => void;
  onPayment?: (billId: string) => void;
}

export default function BillDrawer({ bill, onClose, onPayment }: BillDrawerProps) {
  const [loading, setLoading] = useState(false);

  if (!bill) return null;

  const getStatusColor = (status: string) => {
    const colors = {
      draft: "bg-gray-100 text-gray-800",
      open: "bg-blue-100 text-blue-800",
      partially_paid: "bg-yellow-100 text-yellow-800",
      paid: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
      cancelled: "bg-gray-100 text-gray-800"
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const handleMakePayment = () => {
    if (onPayment) {
      onPayment(bill.id);
    }
  };

  return (
    <aside className="fixed right-6 top-24 w-96 bg-white shadow-lg rounded-lg max-h-[80vh] overflow-y-auto">
      <div className="sticky top-0 bg-white border-b px-6 py-4">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-lg font-semibold">{bill.billNumber}</h4>
            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(bill.status)}`}>
              {bill.status.replace("_", " ")}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            ✕
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Bill Details */}
        <div className="mb-6">
          <h5 className="font-medium text-sm text-gray-700 mb-3">Bill Details</h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Vendor ID:</span>
              <span className="font-medium">{bill.vendorId}</span>
            </div>
            {bill.poId && (
              <div className="flex justify-between">
                <span className="text-gray-500">PO Reference:</span>
                <span className="font-medium">{bill.poId}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Bill Date:</span>
              <span>{format(new Date(bill.billDate), "MMM dd, yyyy")}</span>
            </div>
            {bill.dueDate && (
              <div className="flex justify-between">
                <span className="text-gray-500">Due Date:</span>
                <span>{format(new Date(bill.dueDate), "MMM dd, yyyy")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Line Items */}
        <div className="mb-6">
          <h5 className="font-medium text-sm text-gray-700 mb-3">Line Items</h5>
          <div className="space-y-3">
            {bill.items.map((item) => (
              <div key={item.id} className="border-b pb-3">
                <div className="text-sm font-medium">{item.description}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {item.quantity} × {bill.currency} {item.unitPrice.toLocaleString()}
                  {item.taxRate && ` (${item.taxRate}% tax)`}
                </div>
                <div className="text-sm font-medium text-right mt-1">
                  {bill.currency} {item.lineAmount.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="mb-6">
          <h5 className="font-medium text-sm text-gray-700 mb-3">Totals</h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal:</span>
              <span>{bill.currency} {bill.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Taxes:</span>
              <span>{bill.currency} {bill.taxes.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-semibold text-base border-t pt-2">
              <span>Total:</span>
              <span>{bill.currency} {bill.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Balance Due:</span>
              <span className="font-semibold">{bill.currency} {bill.balanceDue.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {bill.status !== "paid" && bill.status !== "cancelled" && bill.balanceDue > 0 && (
          <div className="space-y-2">
            <button
              onClick={handleMakePayment}
              className="w-full btn btn-primary"
              disabled={loading}
            >
              {loading ? "Processing..." : "Make Payment"}
            </button>
            <button className="w-full btn btn-outline">
              Edit Bill
            </button>
          </div>
        )}

        {bill.status === "paid" && (
          <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
            This bill has been paid in full.
          </div>
        )}
      </div>
    </aside>
  );
}
