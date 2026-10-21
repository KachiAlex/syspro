"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const DAY = 86_400_000;
const ROW_H = 28;
const LABEL_W = 260;
const DAY_W = 26;

interface GanttTask {
  id: string;
  title: string;
  dbStatus: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  percentComplete: number;
  dependsOnTaskId: string | null;
  assignedTo: string;
}

function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * DAY);
}
function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: "#10b981",
  IN_PROGRESS: "#6366f1",
  ON_HOLD: "#f59e0b",
  CANCELLED: "#64748b",
  BLOCKED: "#ef4444",
  NOT_STARTED: "#475569",
};

export default function GanttPage() {
  const { tenantSlug } = useTenantContext();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then((d) => {
      const list = (d.projects ?? []).map((p: any) => ({ id: p.id, name: p.name }));
      setProjects(list);
      if (list.length && !projectId) setProjectId(list[0].id);
    }).catch(() => setError("Failed to load projects"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const d = await fetch(`/api/projects/tasks?projectId=${projectId}`).then((r) => r.json());
      setTasks((d.tasks ?? []).filter((t: GanttTask) => t.plannedStart && t.plannedEnd));
      setError("");
    } catch {
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const { minDate, totalDays, bars } = useMemo(() => {
    if (!tasks.length) return { minDate: new Date(), totalDays: 30, bars: [] as any[] };
    const dates = tasks.flatMap((t) => [new Date(t.plannedStart!), new Date(t.plannedEnd!)]);
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    const pad = 3;
    const start = addDays(min, -pad);
    const span = Math.max(daysBetween(start, max) + pad, 14);
    const mapped = tasks.map((t, i) => {
      const s = daysBetween(start, new Date(t.plannedStart!));
      const e = daysBetween(start, new Date(t.plannedEnd!));
      return { task: t, i, x: s * DAY_W, w: Math.max((e - s + 1) * DAY_W, DAY_W), start: s, end: e };
    });
    return { minDate: start, totalDays: span, bars: mapped };
  }, [tasks]);

  const byId = useMemo(() => new Map(bars.map((b) => [b.task.id, b])), [bars]);
  const todayX = useMemo(() => {
    const n = daysBetween(minDate, new Date());
    return n >= 0 && n <= totalDays ? n * DAY_W : null;
  }, [minDate, totalDays]);

  const weeks = useMemo(() => {
    const out: { label: string; x: number }[] = [];
    for (let i = 0; i <= totalDays; i += 7) {
      out.push({ label: fmt(addDays(minDate, i)).slice(5), x: i * DAY_W });
    }
    return out;
  }, [minDate, totalDays]);

  if (!tenantSlug) return null;

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-1 text-2xl font-bold">Project Gantt</h1>
        <p className="mb-4 text-sm text-slate-400">Timeline view — planned dates, % complete, dependencies</p>
        <div className="mb-4 flex items-center gap-3">
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {loading && <span className="text-xs text-slate-500">Loading…</span>}
          <span className="ml-auto flex gap-3 text-xs text-slate-400">
            {Object.entries(STATUS_COLOR).slice(0, 4).map(([s, c]) => (
              <span key={s} className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{s.replace("_", " ").toLowerCase()}</span>
            ))}
          </span>
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{error}</div>}

        {!tasks.length && !loading && (
          <p className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-500">
            No tasks with planned start/end dates in this project
          </p>
        )}

        {tasks.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
            <svg width={LABEL_W + totalDays * DAY_W + DAY_W} height={40 + bars.length * ROW_H + 10} className="block">
              {/* header ticks */}
              <g>
                {weeks.map((w, i) => (
                  <g key={i}>
                    <line x1={LABEL_W + w.x} y1={34} x2={LABEL_W + w.x} y2={40 + bars.length * ROW_H} stroke="#1e293b" />
                    <text x={LABEL_W + w.x + 3} y={28} fontSize={10} fill="#64748b">{w.label}</text>
                  </g>
                ))}
                <line x1={0} y1={36} x2={LABEL_W + totalDays * DAY_W} y2={36} stroke="#334155" />
              </g>
              {/* today line */}
              {todayX != null && (
                <line x1={LABEL_W + todayX} y1={0} x2={LABEL_W + todayX} y2={40 + bars.length * ROW_H} stroke="#f43f5e" strokeDasharray="4 3" />
              )}
              {/* rows */}
              {bars.map((b) => {
                const y = 40 + b.i * ROW_H;
                const color = STATUS_COLOR[b.task.dbStatus] ?? STATUS_COLOR.NOT_STARTED;
                return (
                  <g key={b.task.id}>
                    {b.i % 2 === 0 && <rect x={0} y={y} width={LABEL_W + totalDays * DAY_W} height={ROW_H} fill="#0b1220" opacity={0.5} />}
                    <text x={8} y={y + 18} fontSize={11} fill="#cbd5e1" className="select-none">
                      <title>{b.task.title} · {b.task.assignedTo}</title>
                      {b.task.title.length > 32 ? b.task.title.slice(0, 32) + "…" : b.task.title}
                    </text>
                    <rect x={LABEL_W + b.x} y={y + 5} width={b.w} height={ROW_H - 10} rx={4} fill={color} opacity={0.35} />
                    <rect x={LABEL_W + b.x} y={y + 5} width={b.w * Math.min(b.task.percentComplete, 100) / 100} height={ROW_H - 10} rx={4} fill={color} />
                    <text x={LABEL_W + b.x + b.w + 6} y={y + 17} fontSize={10} fill="#94a3b8">{b.task.percentComplete}%</text>
                  </g>
                );
              })}
              {/* dependency arrows */}
              {bars.map((b) => {
                if (!b.task.dependsOnTaskId) return null;
                const dep = byId.get(b.task.dependsOnTaskId);
                if (!dep) return null;
                const x1 = LABEL_W + dep.x + dep.w;
                const y1 = 40 + dep.i * ROW_H + ROW_H / 2;
                const x2 = LABEL_W + b.x;
                const y2 = 40 + b.i * ROW_H + ROW_H / 2;
                return (
                  <path key={`${dep.task.id}-${b.task.id}`}
                    d={`M ${x1} ${y1} C ${x1 + 16} ${y1}, ${x2 - 16} ${y2}, ${x2} ${y2}`}
                    fill="none" stroke="#64748b" strokeWidth={1.2} markerEnd="url(#arr)" />
                );
              })}
              <defs>
                <marker id="arr" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
                </marker>
              </defs>
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
