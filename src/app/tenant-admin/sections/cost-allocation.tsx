"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "@/lib/use-form";
import { TextInput, FormButton, FormAlert } from "@/components/form";

type CostCenter = { id: string; code: string; name: string; region: string; budget: number; spent: number };

const costCenterSchema = z.object({
  code: z.string().min(1, "Cost center code is required").max(20, "Code must be under 20 characters"),
  name: z.string().min(1, "Name is required").max(100),
  region: z.string().min(1, "Region is required"),
  budget: z.number().min(0, "Budget must be a positive number"),
});

type CostCenterFormData = z.infer<typeof costCenterSchema>;

const REGIONS = ["Global", "Americas", "EMEA", "APAC"];

export default function CostAllocationSection({ tenantSlug }: { tenantSlug?: string | null }) {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const ts = tenantSlug ?? "kreatix-default";

  const form = useForm<CostCenterFormData>({
    initialValues: {
      code: "",
      name: "",
      region: "Global",
      budget: 100000,
    },
    schema: costCenterSchema,
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenant/cost-allocation?tenantSlug=${encodeURIComponent(ts)}`);
      const payload = await res.json().catch(() => null);
      if (res.ok && payload) {
        setCostCenters(payload.costCenters ?? []);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load cost centers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [ts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const errors = form.validate();
    if (errors.length > 0) return;

    try {
      const res = await fetch(`/api/tenant/cost-allocation?tenantSlug=${encodeURIComponent(ts)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "cost_center",
          code: form.values.code.toUpperCase(),
          name: form.values.name,
          region: form.values.region,
          budget: form.values.budget,
        }),
      });
      if (!res.ok) throw new Error("Failed to create cost center");
      form.resetForm();
      setShowCreateForm(false);
      setSuccess("Cost center created successfully");
      setTimeout(() => setSuccess(null), 3000);
      await load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function deleteCostCenter(id: string) {
    if (!confirm("Are you sure? This will remove the cost center and its budget allocation.")) return;
    try {
      const res = await fetch(
        `/api/tenant/cost-allocation?id=${encodeURIComponent(id)}&type=cost_center&tenantSlug=${encodeURIComponent(ts)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete cost center");
      setSuccess("Cost center deleted");
      setTimeout(() => setSuccess(null), 3000);
      await load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Cost Allocation</p>
            <h2 className="text-2xl font-semibold text-slate-900">Cost Centers</h2>
            <p className="mt-2 text-sm text-slate-600">
              Create and manage cost centers to organize and track expenses by department, region, or project.
            </p>
          </div>
          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              form.resetForm();
            }}
            className="whitespace-nowrap rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showCreateForm ? "Cancel" : "+ Create Cost Center"}
          </button>
        </div>

        {error && (
          <FormAlert type="error" title="Error" message={error} onClose={() => setError(null)} />
        )}
        {success && <FormAlert type="success" message={success} onClose={() => setSuccess(null)} />}

        {showCreateForm && (
          <form className="mt-6 space-y-4 border-t pt-6" onSubmit={handleCreate}>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="Cost Center Code"
                placeholder="e.g., SALES-EMEA"
                required
                {...form.getFieldProps("code")}
                error={form.errorMap.code}
                hint="Short identifier for this cost center (will be uppercase)"
              />
              <TextInput
                label="Name"
                placeholder="e.g., EMEA Sales Department"
                required
                {...form.getFieldProps("name")}
                error={form.errorMap.name}
                hint="Descriptive name for the cost center"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Region</label>
                <select
                  value={form.values.region}
                  onChange={(e) => form.setValue("region", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <TextInput
                label="Annual Budget"
                type="number"
                placeholder="100000"
                required
                {...form.getFieldProps("budget")}
                error={form.errorMap.budget}
                hint="Annual budget allocation for this cost center"
              />
            </div>

            <div className="flex gap-2 border-t pt-4">
              <FormButton type="submit" loading={form.isSubmitting}>
                Create Cost Center
              </FormButton>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  form.resetForm();
                }}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-600">
              <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"></div>
              <p className="mt-2">Loading cost centers…</p>
            </div>
          ) : (costCenters ?? []).length === 0 ? (
            <div className="rounded-lg bg-blue-50 p-4 text-center text-sm">
              <p className="font-medium text-blue-900">No cost centers created</p>
              <p className="mt-1 text-blue-700">Create your first cost center to start tracking expenses</p>
            </div>
          ) : (
            <div className="space-y-3">
              {costCenters.map((cc) => {
                const utilization = cc.budget > 0 ? (cc.spent / cc.budget) * 100 : 0;
                const percentageText = utilization.toFixed(1);
                const isOverBudget = utilization > 100;
                return (
                  <div key={cc.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900">{cc.code}</h3>
                        <p className="text-sm text-slate-600">{cc.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{cc.region}</p>
                      </div>
                      <button
                        onClick={() => deleteCostCenter(cc.id)}
                        className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-900">Budget Utilization</span>
                        <span className={`font-semibold ${isOverBudget ? "text-rose-600" : "text-slate-900"}`}>
                          {percentageText}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full transition-all ${
                            utilization > 100 ? "bg-rose-500" : utilization > 80 ? "bg-yellow-500" : "bg-green-500"
                          }`}
                          style={{ width: `${Math.min(utilization, 100)}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <p className="text-slate-500">Budget</p>
                          <p className="font-semibold text-slate-900">₦{cc.budget.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Spent</p>
                          <p className="font-semibold text-slate-900">₦{cc.spent.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Remaining</p>
                          <p className={`font-semibold ${isOverBudget ? "text-rose-600" : "text-green-600"}`}>
                            ₦{Math.max(0, cc.budget - cc.spent).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
