'use client';

import React, { useEffect, useState } from 'react';

type Row = { bill_id: string; bill_number: string; vendor_name: string; due_date: string; amount: number; paid_amount: number; status: string; installment_no: number };

export default function BillSchedulesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/finance/bill-schedules')
      .then((r) => r.json())
      .then((d) => setRows(d.schedules ?? []))
      .catch(() => setError('Failed to load schedules'));
  }, []);

  const overdue = rows.filter((r) => r.status !== 'paid' && new Date(r.due_date) < new Date()).length;
  const outstanding = rows.filter((r) => r.status !== 'paid').reduce((s, r) => s + Number(r.amount) - Number(r.paid_amount ?? 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-theme-text-primary">Bill Payment Schedules</h1>
        <p className="text-sm text-theme-text-secondary">
          Installment due dates from payment terms — payments walk each line in due order.
        </p>
      </div>
      {error && <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border border-theme-border rounded-lg p-4">
          <div className="text-xs text-theme-text-secondary uppercase">Outstanding</div>
          <div className="text-2xl font-bold text-theme-text-primary">₦{outstanding.toLocaleString()}</div>
        </div>
        <div className="border border-theme-border rounded-lg p-4">
          <div className="text-xs text-theme-text-secondary uppercase">Overdue installments</div>
          <div className="text-2xl font-bold text-red-600">{overdue}</div>
        </div>
        <div className="border border-theme-border rounded-lg p-4">
          <div className="text-xs text-theme-text-secondary uppercase">Scheduled lines</div>
          <div className="text-2xl font-bold text-theme-text-primary">{rows.length}</div>
        </div>
      </div>

      <div className="border border-theme-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-theme-muted text-left">
            <tr><th className="px-4 py-2">Bill</th><th className="px-4 py-2">Vendor</th><th className="px-4 py-2">Installment</th><th className="px-4 py-2">Due</th><th className="px-4 py-2">Amount</th><th className="px-4 py-2">Paid</th><th className="px-4 py-2">Status</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const late = r.status !== 'paid' && new Date(r.due_date) < new Date();
              return (
                <tr key={i} className="border-t border-theme-border">
                  <td className="px-4 py-2 font-medium">{r.bill_number}</td>
                  <td className="px-4 py-2">{r.vendor_name ?? '—'}</td>
                  <td className="px-4 py-2">#{r.installment_no}</td>
                  <td className={`px-4 py-2 ${late ? 'text-red-600 font-semibold' : ''}`}>{String(r.due_date).slice(0, 10)}{late ? ' (overdue)' : ''}</td>
                  <td className="px-4 py-2">₦{Number(r.amount).toLocaleString()}</td>
                  <td className="px-4 py-2">₦{Number(r.paid_amount ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-2"><span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${r.status === 'paid' ? 'bg-green-100 text-green-800' : late ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{r.status}</span></td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-theme-text-secondary">No schedules — bills with payment terms get installment rows automatically.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
