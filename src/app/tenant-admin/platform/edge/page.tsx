"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const TABS = ["allocations", "activity", "sharing", "energy", "cms"] as const;

export default function PlatformEdgePage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<(typeof TABS)[number]>("energy");
  const [data, setData] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [f, setF] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    const [a, act, s, e, posts, pages] = await Promise.all([
      fetch("/api/platform/edge?view=asset-allocations").then((r) => r.json()).catch(() => ({})),
      fetch("/api/platform/edge?view=asset-activity").then((r) => r.json()).catch(() => ({})),
      fetch("/api/platform/edge?view=doc-shares").then((r) => r.json()).catch(() => ({})),
      fetch("/api/platform/edge?view=energy").then((r) => r.json()).catch(() => ({})),
      fetch("/api/platform/edge?view=cms-posts").then((r) => r.json()).catch(() => ({})),
      fetch("/api/platform/edge?view=cms-pages").then((r) => r.json()).catch(() => ({})),
    ]);
    setData({
      allocations: a.allocations ?? [], activity: act.activity ?? [],
      shares: s.shares ?? [], leaderboard: e.leaderboard ?? [], energyLog: e.log ?? [],
      posts: posts.posts ?? [], pages: pages.pages ?? [],
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/platform/edge", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Failed"); return null; }
    setError(""); load(); return d;
  };

  const input = "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm";
  const btn = "rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500";
  const btnSm = "rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700";
  const th = "p-3";

  if (!tenantSlug) return null;

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-1 text-2xl font-bold">Platform Edge</h1>
        <p className="mb-4 text-sm text-slate-400">Asset allocations &amp; activity, document sharing, energy points, CMS content</p>
        <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-slate-900 p-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm capitalize ${tab === t ? "bg-slate-700" : "text-slate-400 hover:text-white"}`}>{t}</button>
          ))}
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{error}<button onClick={() => setError("")} className="ml-2 underline">dismiss</button></div>}
        {msg && <div className="mb-4 rounded-lg bg-slate-800 p-3 text-sm">{msg}<button onClick={() => setMsg("")} className="ml-2 underline">dismiss</button></div>}

        {tab === "allocations" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Asset ID" value={f.alAsset ?? ""} onChange={(e) => setF({ ...f, alAsset: e.target.value })} className={input} />
              <input placeholder="Employee ID" value={f.alEmp ?? ""} onChange={(e) => setF({ ...f, alEmp: e.target.value })} className={input} />
              <input type="date" value={f.alFrom ?? ""} onChange={(e) => setF({ ...f, alFrom: e.target.value })} className={input} />
              <input type="date" value={f.alTo ?? ""} onChange={(e) => setF({ ...f, alTo: e.target.value })} className={input} />
              <button className={btn} onClick={() => post({ action: "allocate-asset", assetId: f.alAsset, employeeId: f.alEmp, fromDate: f.alFrom, toDate: f.alTo || undefined })}>Allocate</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Asset</th><th className={th}>Employee</th><th className={th}>Shift</th><th className={th}>From</th><th className={th}>To</th><th className={th}></th></tr></thead>
              <tbody>
                {data.allocations?.map((a: any) => (
                  <tr key={a.id} className="border-t border-slate-800/50">
                    <td className={th}>{a.asset_name ?? a.asset_id}</td><td className={th}>{a.employee_id ?? "—"}</td>
                    <td className={th}>{a.shift_id ?? "—"}</td>
                    <td className={th}>{String(a.from_date).slice(0, 10)}</td><td className={th}>{a.to_date ? String(a.to_date).slice(0, 10) : "open"}</td>
                    <td className={th}>{!a.to_date && <button className={btnSm} onClick={() => post({ action: "end-allocation", id: a.id })}>End</button>}</td>
                  </tr>
                ))}
                {!data.allocations?.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No allocations</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "activity" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Asset ID" value={f.actAsset ?? ""} onChange={(e) => setF({ ...f, actAsset: e.target.value })} className={input} />
              <input placeholder="Type (reading/repair)" value={f.actType ?? ""} onChange={(e) => setF({ ...f, actType: e.target.value })} className={input} />
              <input type="number" placeholder="Reading" value={f.actVal ?? ""} onChange={(e) => setF({ ...f, actVal: e.target.value })} className={`${input} w-28`} />
              <button className={btn} onClick={() => post({ action: "log-activity", assetId: f.actAsset, activityType: f.actType, readingValue: f.actVal ? Number(f.actVal) : undefined })}>Log</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Asset</th><th className={th}>Type</th><th className={th}>Reading</th><th className={th}>When</th></tr></thead>
              <tbody>
                {data.activity?.map((l: any) => (
                  <tr key={l.id} className="border-t border-slate-800/50">
                    <td className={th}>{l.asset_name ?? l.asset_id}</td><td className={th}>{l.activity_type}</td>
                    <td className={th}>{l.reading_value ?? "—"}</td><td className={th}>{String(l.created_at).slice(0, 16)}</td>
                  </tr>
                ))}
                {!data.activity?.length && <tr><td colSpan={4} className="p-6 text-center text-slate-500">No activity logged</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "sharing" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Doc type (e.g. invoices)" value={f.shType ?? ""} onChange={(e) => setF({ ...f, shType: e.target.value })} className={input} />
              <input placeholder="Doc ID" value={f.shId ?? ""} onChange={(e) => setF({ ...f, shId: e.target.value })} className={input} />
              <input placeholder="User ID" value={f.shUser ?? ""} onChange={(e) => setF({ ...f, shUser: e.target.value })} className={input} />
              <select value={f.shPerm ?? "read"} onChange={(e) => setF({ ...f, shPerm: e.target.value })} className={input}>
                <option value="read">read</option><option value="write">write</option>
              </select>
              <button className={btn} onClick={() => post({ action: "share-doc", docType: f.shType, docId: f.shId, sharedWith: f.shUser, permission: f.shPerm })}>Share</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Doc</th><th className={th}>Shared with</th><th className={th}>Permission</th><th className={th}>By</th><th className={th}></th></tr></thead>
              <tbody>
                {data.shares?.map((s: any) => (
                  <tr key={s.id} className="border-t border-slate-800/50">
                    <td className={`${th} font-mono text-xs`}>{s.doc_type}:{String(s.doc_id).slice(0, 10)}</td>
                    <td className={th}>{s.shared_with}</td><td className={th}>{s.permission}</td>
                    <td className={th}>{s.created_by ?? "—"}</td>
                    <td className={th}><button className={btnSm} onClick={() => post({ action: "unshare-doc", id: s.id })}>Unshare</button></td>
                  </tr>
                ))}
                {!data.shares?.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No shared documents</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "energy" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h3 className="mb-3 font-semibold">Leaderboard</h3>
              <div className="flex flex-wrap gap-2">
                <input placeholder="User ID" value={f.enUser ?? ""} onChange={(e) => setF({ ...f, enUser: e.target.value })} className={input} />
                <input type="number" placeholder="Points" value={f.enPts ?? 10} onChange={(e) => setF({ ...f, enPts: e.target.value })} className={`${input} w-24`} />
                <input placeholder="Reason" value={f.enWhy ?? ""} onChange={(e) => setF({ ...f, enWhy: e.target.value })} className={`${input} flex-1`} />
                <button className={btn} onClick={() => post({ action: "award-points", userId: f.enUser, points: Number(f.enPts ?? 10), reason: f.enWhy })}>Award</button>
              </div>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {data.leaderboard?.map((u: any, i: number) => (
                    <tr key={u.user_id} className="border-t border-slate-800/50">
                      <td className="py-2">{i + 1}. {u.user_id}</td>
                      <td className="py-2 text-right font-semibold text-emerald-400">{u.total_points} pts</td>
                    </tr>
                  ))}
                  {!data.leaderboard?.length && <tr><td className="py-4 text-center text-slate-500">No points yet</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h3 className="mb-3 font-semibold">Points Log</h3>
              <table className="w-full text-sm">
                <tbody>
                  {data.energyLog?.slice(0, 20).map((l: any) => (
                    <tr key={l.id} className="border-t border-slate-800/50">
                      <td className="py-1.5">{l.user_id}</td>
                      <td className={`py-1.5 text-right ${Number(l.points) < 0 ? "text-red-400" : "text-emerald-400"}`}>{l.points > 0 ? "+" : ""}{l.points}</td>
                      <td className="py-1.5 text-right text-xs text-slate-500">{l.reason ?? ""}</td>
                    </tr>
                  ))}
                  {!data.energyLog?.length && <tr><td className="py-4 text-center text-slate-500">No log entries</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "cms" && (
          <div className="space-y-6">
            <section>
              <h3 className="mb-2 font-semibold">Blog Posts</h3>
              <div className="flex flex-wrap gap-2">
                <input placeholder="Title" value={f.cmsTitle ?? ""} onChange={(e) => setF({ ...f, cmsTitle: e.target.value })} className={input} />
                <input placeholder="slug" value={f.cmsSlug ?? ""} onChange={(e) => setF({ ...f, cmsSlug: e.target.value })} className={input} />
                <input placeholder="Category" value={f.cmsCat ?? ""} onChange={(e) => setF({ ...f, cmsCat: e.target.value })} className={input} />
                <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={f.cmsPub ?? false} onChange={(e) => setF({ ...f, cmsPub: e.target.checked })} /> Publish</label>
                <button className={btn} onClick={() => post({ action: "upsert-post", title: f.cmsTitle, slug: f.cmsSlug, content: f.cmsBody ?? "", category: f.cmsCat, published: f.cmsPub })}>Save Post</button>
              </div>
              <textarea placeholder="Content" value={f.cmsBody ?? ""} onChange={(e) => setF({ ...f, cmsBody: e.target.value })} className={`${input} mt-2 w-full`} rows={3} />
              <div className="mt-2 space-y-1">
                {data.posts?.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded bg-slate-900 px-3 py-2 text-sm">
                    <span>{p.title} <span className="text-slate-500">/{p.slug}</span></span>
                    <span className={p.published ? "text-emerald-400" : "text-slate-500"}>{p.published ? "published" : "draft"}</span>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h3 className="mb-2 font-semibold">Pages</h3>
              <div className="flex flex-wrap gap-2">
                <input placeholder="Title" value={f.pgTitle ?? ""} onChange={(e) => setF({ ...f, pgTitle: e.target.value })} className={input} />
                <input placeholder="slug" value={f.pgSlug ?? ""} onChange={(e) => setF({ ...f, pgSlug: e.target.value })} className={input} />
                <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={f.pgPub ?? false} onChange={(e) => setF({ ...f, pgPub: e.target.checked })} /> Publish</label>
                <button className={btn} onClick={() => post({ action: "upsert-page", title: f.pgTitle, slug: f.pgSlug, content: f.pgBody ?? "", published: f.pgPub })}>Save Page</button>
              </div>
              <textarea placeholder="Content" value={f.pgBody ?? ""} onChange={(e) => setF({ ...f, pgBody: e.target.value })} className={`${input} mt-2 w-full`} rows={3} />
              <div className="mt-2 space-y-1">
                {data.pages?.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded bg-slate-900 px-3 py-2 text-sm">
                    <span>{p.title} <span className="text-slate-500">/{p.slug}</span></span>
                    <span className={p.published ? "text-emerald-400" : "text-slate-500"}>{p.published ? "published" : "draft"}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
