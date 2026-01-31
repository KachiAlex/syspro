"use client";

import { useEffect, useState } from "react";

type Report = { id: string; name: string; type: string; period: string; createdAt: string; status: string };
type Export = { id: string; reportId: string; format: string; scheduledFor?: string | null; status: string };

export default function AnalyticsSection({ tenantSlug }: { tenantSlug?: string | null }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [exports, setExports] = useState<Export[]>([]);
  const [loading, setLoading] = useState(true);
  const ts = tenantSlug ?? "kreatix-default";

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/analytics?tenantSlug=${encodeURIComponent(ts)}`);
      const payload = await res.json().catch(() => null);
      if (res.ok && payload) {
        setReports(payload.reports ?? []);
        setExports(payload.exports ?? []);
      }
    } catch (err) {
      console.warn("analytics load failed", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [ts]);

  async function createReport() {
    const name = prompt("Report name:");
    if (!name) return;
    const res = await fetch(`/api/tenant/analytics?tenantSlug=${encodeURIComponent(ts)}`, {
      method: "POST",
      body: JSON.stringify({ type: "report", name, reportType: "custom" }),
    });
    await res.json().catch(() => null);
    load();
  }

  async function scheduleExport(reportId: string) {
    const format = prompt("Export format (csv/pdf):", "csv");
    if (!format) return;
    const res = await fetch(`/api/tenant/analytics?tenantSlug=${encodeURIComponent(ts)}`, {
      method: "POST",
      body: JSON.stringify({ type: "export", reportId, format }),
    });
    await res.json().catch(() => null);
    load();
  }

  async function deleteReport(id: string) {
    await fetch(`/api/tenant/analytics?id=${encodeURIComponent(id)}&type=report&tenantSlug=${encodeURIComponent(ts)}`, { method: "DELETE" });
    load();
  }

  if (loading) return <div>Loading analytics…</div>;

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Reports</h3>
          <button className="btn" onClick={createReport}>Create Report</button>
        </div>
        {reports.length === 0 ? (
          <div>No reports.</div>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-sm text-muted-foreground">{r.type} · {r.period} · {r.status}</div>
                </div>
                <div className="flex items-center gap-3">
                  <button className="btn" onClick={() => scheduleExport(r.id)}>Export</button>
                  <button className="btn" onClick={() => deleteReport(r.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-lg font-semibold">Scheduled Exports</h3>
        {exports.length === 0 ? (
          <div>No exports scheduled.</div>
        ) : (
          <div className="space-y-2">
            {exports.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="font-medium">Report {e.reportId} → {e.format.toUpperCase()}</div>
                  <div className="text-sm text-muted-foreground">{e.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
