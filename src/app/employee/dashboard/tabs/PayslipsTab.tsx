'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Wallet, AlertCircle, Download } from 'lucide-react';

interface EmployeeProfile {
  id: string; name: string; email: string; jobTitle: string; role: string;
  departmentId: string; employmentType: string; status: string;
  hireDate: string; salary: number; lastLogin: string;
}

interface Payslip {
  id: string;
  period: string;
  base_salary: number;
  transport_allowance: number;
  housing_allowance: number;
  meal_allowance: number;
  bonus: number;
  tax: number;
  pension: number;
  health_insurance: number;
  other_deductions: number;
  net_pay: number;
  status: string;
  created_at: string;
}

export function PayslipsTab({ profile: _profile }: { profile: EmployeeProfile }) {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPayslips = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hr/employees/portal/payslips');
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPayslips(data.payslips || []);
      } else {
        setError(data.error || 'Failed to load payslips');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPayslips(); }, [loadPayslips]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Payslips</h2>
        <p className="text-sm text-gray-500 mt-0.5">Your salary payment history</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {payslips.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
          <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No payslips available yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payslips.map(p => {
            const totalEarnings = Number(p.base_salary) + Number(p.transport_allowance) + Number(p.housing_allowance) + Number(p.meal_allowance) + Number(p.bonus);
            const totalDeductions = Number(p.tax) + Number(p.pension) + Number(p.health_insurance) + Number(p.other_deductions);
            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900">{p.period}</h3>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium mt-1 ${
                      p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Net Pay</p>
                    <p className="text-xl font-bold text-gray-900">₦{Number(p.net_pay).toLocaleString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Earnings</p>
                    <div className="space-y-1">
                      <Row label="Base Salary" value={p.base_salary} />
                      {Number(p.transport_allowance) > 0 && <Row label="Transport" value={p.transport_allowance} />}
                      {Number(p.housing_allowance) > 0 && <Row label="Housing" value={p.housing_allowance} />}
                      {Number(p.meal_allowance) > 0 && <Row label="Meal" value={p.meal_allowance} />}
                      {Number(p.bonus) > 0 && <Row label="Bonus" value={p.bonus} />}
                      <div className="border-t border-gray-100 pt-1 mt-1">
                        <Row label="Total Earnings" value={totalEarnings} bold />
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Deductions</p>
                    <div className="space-y-1">
                      {Number(p.tax) > 0 && <Row label="Tax" value={p.tax} negative />}
                      {Number(p.pension) > 0 && <Row label="Pension" value={p.pension} negative />}
                      {Number(p.health_insurance) > 0 && <Row label="Health Insurance" value={p.health_insurance} negative />}
                      {Number(p.other_deductions) > 0 && <Row label="Other" value={p.other_deductions} negative />}
                      <div className="border-t border-gray-100 pt-1 mt-1">
                        <Row label="Total Deductions" value={totalDeductions} bold negative />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold, negative }: { label: string; value: number; bold?: boolean; negative?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
      <span>{label}</span>
      <span>{negative ? '-' : ''}₦{Number(value).toLocaleString()}</span>
    </div>
  );
}
