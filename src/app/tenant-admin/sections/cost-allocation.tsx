"use client";

import { useEffect, useState } from "react";

type CostCenter = { id: string; code: string; name: string; region: string; budget: number; spent: number };

export default function CostAllocationSection({ tenantSlug }: { tenantSlug?: string | null }) {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const ts = tenantSlug ?? "kreatix-default";

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/cost-allocation?tenantSlug=${encodeURIComponent(ts)}`);
      const payload = await res.json().catch(() => null);
      if (res.ok && payload) {
        setCostCenters(payload.costCenters ?? []);
      }
    } catch (err) {
      console.warn("cost allocation load failed", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [ts]);

  async function createCostCenter() {
    const code = prompt("Cost center code (e.g., SALES-EMEA):");
    if (!code) return;
    const res = await fetch(`/api/tenant/cost-allocation?tenantSlug=${encodeURIComponent(ts)}`, {
      method: "POST",
      body: JSON.stringify({ type: "cost_center", code, name: code, region: "Global", budget: 100000 }),
    });
    await res.json().catch(() => null);
    load();
  }

  async function deleteCostCenter(id: string) {
    await fetch(`/api/tenant/cost-allocation?id=${encodeURIComponent(id)}&type=cost_center&tenantSlug=${encodeURIComponent(ts)}`, {
      method: "DELETE",
    });
    load();
  }

  if (loading) return <div>Loading cost allocation…</div>;

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Cost Centers</h3>
          <button className="btn" onClick={createCostCenter}>Create Cost Center</button>
        </div>
        {(costCenters ?? []).length === 0 ? (
          <div>No cost centers.</div>
        ) : (
          <div className="space-y-2">
            {(costCenters ?? []).map((cc) => {
              const utilization = cc.budget > 0 ? ((cc.spent / cc.budget) * 100).toFixed(1) : 0;
              return (
                <div key={cc.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{cc.code} · {cc.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {cc.region} · Budget: ₦{cc.budget.toLocaleString()} · Spent: ₦{cc.spent.toLocaleString()} · {utilization}%
                    </div>
                  </div>
                  <button className="btn" onClick={() => deleteCostCenter(cc.id)}>Delete</button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
