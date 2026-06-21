'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign,
  Users,
  Settings,
  Calculator,
  Play,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Save,
  RotateCcw,
  TrendingUp,
  ShieldCheck,
  History,
  FileText,
  Eye,
} from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { getCurrencySymbol } from '@/lib/tenant/currency';
import { HRService } from '@/app/tenant-admin/sections/hr-service';

interface EmployeePayroll {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  baseSalary: number;
  allowances: number;
  bonus: number;
  deductions: number;
  tax: number;
  netPay: number;
  status: string;
}

interface PayrollConfig {
  taxRate: number;
  pensionRate: number;
  healthInsuranceRate: number;
  transportAllowance: number;
  housingAllowance: number;
  mealAllowance: number;
}

interface PayrollRun {
  id: string;
  period: string;
  status: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  anomalies: Array<{ type: string; severity: string; message: string; employeeName?: string }>;
  compliancePassed: boolean;
  createdAt: string;
}

const defaultConfig: PayrollConfig = {
  taxRate: 7.5,
  pensionRate: 8,
  healthInsuranceRate: 5,
  transportAllowance: 20000,
  housingAllowance: 0,
  mealAllowance: 15000,
};

export default function PayrollPage() {
  const { tenantSlug, currency } = useTenantContext();
  const sym = getCurrencySymbol(currency);

  const [employees, setEmployees] = useState<EmployeePayroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<PayrollConfig>(defaultConfig);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [anomalies, setAnomalies] = useState<PayrollRun['anomalies']>([]);
  const [complianceIssues, setComplianceIssues] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  const loadEmployees = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const [fetched, runs] = await Promise.all([
        HRService.getEmployees(tenantSlug).catch(() => []),
        HRService.listPayrollRuns(tenantSlug).catch(() => []),
      ]);
      const payrollRows: EmployeePayroll[] = fetched.map((emp) => ({
        id: emp.id,
        name: emp.name,
        email: emp.email,
        department: emp.department,
        position: emp.position,
        baseSalary: emp.salary ?? 0,
        allowances: 0,
        bonus: 0,
        deductions: 0,
        tax: 0,
        netPay: 0,
        status: emp.status,
      }));
      setEmployees(payrollRows);
      setPayrollRuns(runs);
    } catch (err) {
      console.error('Failed to load employees:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const recalc = useCallback(
    (rows: EmployeePayroll[], cfg: PayrollConfig) => {
      return rows.map((emp) => {
        const allowances =
          cfg.transportAllowance + cfg.housingAllowance + cfg.mealAllowance;
        const gross = emp.baseSalary + allowances + emp.bonus;
        const tax = (gross * cfg.taxRate) / 100;
        const pension = (gross * cfg.pensionRate) / 100;
        const health = (gross * cfg.healthInsuranceRate) / 100;
        const deductions = tax + pension + health;
        const netPay = gross - deductions;
        return { ...emp, allowances, tax, deductions, netPay };
      });
    },
    []
  );

  const computed = useMemo(() => recalc(employees, config), [employees, config, recalc]);

  const totals = useMemo(() => {
    const totalBase = computed.reduce((s, e) => s + e.baseSalary, 0);
    const totalAllowances = computed.reduce((s, e) => s + e.allowances, 0);
    const totalBonus = computed.reduce((s, e) => s + e.bonus, 0);
    const totalTax = computed.reduce((s, e) => s + e.tax, 0);
    const totalDeductions = computed.reduce((s, e) => s + e.deductions, 0);
    const totalNet = computed.reduce((s, e) => s + e.netPay, 0);
    const avgSalary = computed.length ? totalBase / computed.length : 0;
    return {
      totalBase,
      totalAllowances,
      totalBonus,
      totalTax,
      totalDeductions,
      totalNet,
      avgSalary,
      count: computed.length,
    };
  }, [computed]);

  // Department cost attribution
  const deptCosts = useMemo(() => {
    const map = new Map<string, { gross: number; net: number; count: number }>();
    for (const emp of computed) {
      const d = emp.department || 'Unassigned';
      const cur = map.get(d) || { gross: 0, net: 0, count: 0 };
      cur.gross += emp.baseSalary + emp.allowances + emp.bonus;
      cur.net += emp.netPay;
      cur.count += 1;
      map.set(d, cur);
    }
    return Array.from(map.entries()).map(([name, data]) => ({ name, ...data }));
  }, [computed]);

  const updateBonus = (id: string, value: number) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, bonus: value } : e))
    );
    setProcessed(false);
  };

  const handleProcess = async () => {
    if (!tenantSlug || computed.length === 0) return;
    setProcessing(true);
    setAnomalies([]);
    setComplianceIssues([]);

    try {
      const entries = computed.map((emp) => ({
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        position: emp.position,
        baseSalary: emp.baseSalary,
        transportAllowance: emp.allowances, // simplified: all allowances lumped for now
        housingAllowance: 0,
        mealAllowance: 0,
        bonus: emp.bonus,
        tax: emp.tax,
        pension: (emp.baseSalary + emp.allowances + emp.bonus) * (config.pensionRate / 100),
        healthInsurance: (emp.baseSalary + emp.allowances + emp.bonus) * (config.healthInsuranceRate / 100),
        otherDeductions: 0,
        totalDeductions: emp.deductions,
        grossPay: emp.baseSalary + emp.allowances + emp.bonus,
        netPay: emp.netPay,
      }));

      const result = await HRService.createPayrollRun({
        tenantSlug,
        period: selectedMonth,
        config,
        entries,
      });

      setAnomalies(result.anomalies || []);
      setComplianceIssues(result.compliance?.issues || []);
      setProcessed(true);

      // Refresh history
      const runs = await HRService.listPayrollRuns(tenantSlug);
      setPayrollRuns(runs);
    } catch (err) {
      console.error('Failed to process payroll:', err);
    } finally {
      setProcessing(false);
    }
  };

  const formatMoney = (n: number) => `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payroll Management</h2>
          <p className="text-sm text-gray-500 mt-1">Configure, calculate and process payroll</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <button
            onClick={() => setShowConfig((s) => !s)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Settings className="w-4 h-4" />
            Configuration
            {showConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={handleProcess}
            disabled={processing || computed.length === 0}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
              processed
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-blue-600 hover:bg-blue-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {processed ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Processed
              </>
            ) : processing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Payroll
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('current')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'current'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Current Payroll
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <History className="w-4 h-4 inline mr-1" />
            Payroll History ({payrollRuns.length})
          </button>
        </nav>
      </div>

      {activeTab === 'current' && (
        <>
          {/* Anomalies & Compliance */}
          {(anomalies.length > 0 || complianceIssues.length > 0) && (
            <div className="space-y-3">
              {anomalies.filter((a) => a.severity === 'error').length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="text-red-800 text-sm">
                      <p className="font-semibold mb-1">Anomalies Detected</p>
                      {anomalies
                        .filter((a) => a.severity === 'error')
                        .map((a, i) => (
                          <p key={i} className="text-red-700">
                            {a.employeeName ? `${a.employeeName}: ` : ''}{a.message}
                          </p>
                        ))}
                    </div>
                  </div>
                </div>
              )}
              {anomalies.filter((a) => a.severity === 'warning').length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-amber-800 text-sm">
                      <p className="font-semibold mb-1">Warnings</p>
                      {anomalies
                        .filter((a) => a.severity === 'warning')
                        .map((a, i) => (
                          <p key={i} className="text-amber-700">
                            {a.employeeName ? `${a.employeeName}: ` : ''}{a.message}
                          </p>
                        ))}
                    </div>
                  </div>
                </div>
              )}
              {complianceIssues.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div className="text-orange-800 text-sm">
                      <p className="font-semibold mb-1">Compliance Issues</p>
                      {complianceIssues.map((issue, i) => (
                        <p key={i} className="text-orange-700">{issue}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {anomalies.length === 0 && complianceIssues.length === 0 && processed && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="text-green-800 text-sm">
                      <p className="font-semibold">All Checks Passed</p>
                      <p className="text-green-700">No anomalies or compliance issues detected.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

      {showConfig && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            Payroll Configuration
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Tax Rate (%)', key: 'taxRate' as const },
              { label: 'Pension Rate (%)', key: 'pensionRate' as const },
              { label: 'Health Insurance (%)', key: 'healthInsuranceRate' as const },
              { label: 'Transport Allowance', key: 'transportAllowance' as const },
              { label: 'Housing Allowance', key: 'housingAllowance' as const },
              { label: 'Meal Allowance', key: 'mealAllowance' as const },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{field.label}</label>
                <div className="flex items-center gap-2">
                  {field.key.includes('Rate') ? null : <span className="text-sm text-gray-500">{sym}</span>}
                  <input
                    type="number"
                    value={config[field.key]}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        [field.key]: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  {field.key.includes('Rate') ? <span className="text-sm text-gray-500">%</span> : null}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => { setConfig(defaultConfig); setProcessed(false); }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Defaults
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600 mb-2">Total Net Pay</p>
          <p className="text-3xl font-bold text-gray-900">{formatMoney(totals.totalNet)}</p>
          <p className="text-xs text-gray-500 mt-2">{selectedMonth} • {totals.count} employees</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600 mb-2">Base Salary Total</p>
          <p className="text-3xl font-bold text-gray-900">{formatMoney(totals.totalBase)}</p>
          <p className="text-xs text-gray-500 mt-2">Before allowances & deductions</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600 mb-2">Average Salary</p>
          <p className="text-3xl font-bold text-gray-900">{formatMoney(totals.avgSalary)}</p>
          <p className="text-xs text-gray-500 mt-2">Per employee</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600 mb-2">Total Deductions</p>
          <p className="text-3xl font-bold text-red-600">{formatMoney(totals.totalDeductions)}</p>
          <p className="text-xs text-gray-500 mt-2">Tax, pension & insurance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-sm font-medium text-gray-700">Base Salary</span>
            <span className="ml-auto text-sm font-semibold">{formatMoney(totals.totalBase)}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full"
              style={{
                width: `${totals.totalNet ? (totals.totalBase / totals.totalNet) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-gray-700">Allowances</span>
            <span className="ml-auto text-sm font-semibold">{formatMoney(totals.totalAllowances)}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full"
              style={{
                width: `${totals.totalNet ? (totals.totalAllowances / totals.totalNet) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-sm font-medium text-gray-700">Bonuses</span>
            <span className="ml-auto text-sm font-semibold">{formatMoney(totals.totalBonus)}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-purple-500 h-2 rounded-full"
              style={{
                width: `${totals.totalNet ? (totals.totalBonus / totals.totalNet) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Employee Payroll
          </h3>
          <span className="text-xs text-gray-500">{totals.count} employees</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Department</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-900">Base Salary</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-900">Allowances</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-900">Bonus</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-900">Tax</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-900">Deductions</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-900">Net Pay</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-900">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">
                    Loading employees...
                  </td>
                </tr>
              ) : computed.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">
                    No employees found. Add employees in the Staff tab first.
                  </td>
                </tr>
              ) : (
                computed.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                        <p className="text-xs text-gray-500">{emp.position}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{emp.department}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">{formatMoney(emp.baseSalary)}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-600">+{formatMoney(emp.allowances)}</td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        value={emp.bonus || ''}
                        onChange={(e) => updateBonus(emp.id, parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded-lg"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-red-600">-{formatMoney(emp.tax)}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600">-{formatMoney(emp.deductions)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">{formatMoney(emp.netPay)}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          emp.status === 'Active'
                            ? 'bg-green-100 text-green-800'
                            : emp.status === 'On Leave'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {emp.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900" colSpan={2}>
                  Totals
                </td>
                <td className="px-4 py-3 text-sm text-right font-semibold">{formatMoney(totals.totalBase)}</td>
                <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                  +{formatMoney(totals.totalAllowances)}
                </td>
                <td className="px-4 py-3 text-sm text-right font-semibold text-purple-600">
                  +{formatMoney(totals.totalBonus)}
                </td>
                <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">
                  -{formatMoney(totals.totalTax)}
                </td>
                <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">
                  -{formatMoney(totals.totalDeductions)}
                </td>
                <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                  {formatMoney(totals.totalNet)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

          {/* Department Cost Attribution */}
          {deptCosts.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Cost Attribution</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {deptCosts.map((dept) => (
                  <div key={dept.name} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{dept.name}</span>
                      <span className="text-xs text-gray-500">{dept.count} emp</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{formatMoney(dept.net)}</p>
                    <p className="text-xs text-gray-500">Net payroll cost</p>
                    <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${totals.totalNet ? (dept.net / totals.totalNet) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {totals.totalNet ? ((dept.net / totals.totalNet) * 100).toFixed(1) : 0}% of total
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            Deductions Breakdown
          </h4>
          <div className="space-y-3">
            {[
              {
                name: 'Income Tax',
                rate: config.taxRate,
                amount: totals.totalTax,
              },
              {
                name: 'Pension Contribution',
                rate: config.pensionRate,
                amount: (totals.totalBase + totals.totalAllowances + totals.totalBonus) * (config.pensionRate / 100),
              },
              {
                name: 'Health Insurance',
                rate: config.healthInsuranceRate,
                amount: (totals.totalBase + totals.totalAllowances + totals.totalBonus) * (config.healthInsuranceRate / 100),
              },
            ].map((item) => (
              <div key={item.name} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-600">{item.rate}% of gross</p>
                </div>
                <span className="font-semibold text-red-600">-{formatMoney(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Allowances Breakdown
          </h4>
          <div className="space-y-3">
            {[
              { name: 'Transport', amount: config.transportAllowance * totals.count },
              { name: 'Housing', amount: config.housingAllowance * totals.count },
              { name: 'Meal', amount: config.mealAllowance * totals.count },
            ].map((item) => (
              <div key={item.name} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-600">{sym}{item.amount / (totals.count || 1)} per employee</p>
                </div>
                <span className="font-semibold text-green-600">+{formatMoney(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
        </>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              Payroll Run History
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Period</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-900">Gross</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-900">Deductions</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-900">Net Pay</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-900">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-900">Anomalies</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-900">Compliance</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Date</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-900">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payrollRuns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">
                      No payroll runs yet. Process your first payroll to see history here.
                    </td>
                  </tr>
                ) : (
                  payrollRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{run.period}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatMoney(run.totalGross)}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">-{formatMoney(run.totalDeductions)}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold">{formatMoney(run.totalNet)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          run.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : run.status === 'processing'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {run.anomalies?.length > 0 ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            run.anomalies.some((a) => a.severity === 'error')
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {run.anomalies.length} flagged
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Clean
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {run.compliancePassed ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Passed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(run.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          <Eye className="w-4 h-4 inline mr-1" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
