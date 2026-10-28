'use client';

import React, { useEffect, useState } from 'react';
import { Play, Save, Trash2 } from 'lucide-react';
type TableDef = { name: string; label: string; columns: string[] };
type Filter = { field: string; op: string; value: string };
type Saved = { id: string; name: string; description?: string; table_name: string; is_shared: boolean; created_by?: string };

const OPS = [
  { value: '=', label: 'equals' },
  { value: '!=', label: 'not equals' },
  { value: '>', label: 'greater than' },
  { value: '<', label: 'less than' },
  { value: '>=', label: 'at least' },
  { value: '<=', label: 'at most' },
  { value: 'like', label: 'contains' },
  { value: 'is_null', label: 'is empty' },
  { value: 'is_not_null', label: 'is not empty' },
];

export default function ReportBuilderPage() {
  const [tables, setTables] = useState<TableDef[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [name, setName] = useState('');
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const table = tables.find((t) => t.name === tableName);

  useEffect(() => {
    fetch('/api/finance/report-builder?tables=1')
      .then((r) => r.json())
      .then((d) => setTables(d.tables ?? []))
      .catch(() => setError('Failed to load reportable tables'));
    void loadSaved();
  }, []);

  async function loadSaved() {
    const res = await fetch('/api/finance/report-builder');
    const d = await res.json().catch(() => ({}));
    setSaved(d.reports ?? []);
  }

  function pickTable(name: string) {
    setTableName(name);
    const t = tables.find((x) => x.name === name);
    setColumns(t ? t.columns.slice(0, 6) : []);
    setFilters([]);
    setSortField('');
    setRows(null);
  }

  function toggleCol(col: string) {
    setColumns((c) => (c.includes(col) ? c.filter((x) => x !== col) : [...c, col]));
  }

  async function run(action: 'run' | 'runSaved', savedId?: string) {
    setRunning(true); setError(null);
    try {
      const body = action === 'run'
        ? {
            action, tableName, columns,
            filters: filters.filter((f) => f.field),
            sort: sortField ? { field: sortField, dir: sortDir } : undefined,
          }
        : { action, id: savedId };
      const res = await fetch('/api/finance/report-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? 'Run failed');
      setRows(d.rows ?? []);
      if (d.columns) setColumns(d.columns);
      if (d.table) setTableName(d.table);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  }

  async function save() {
    if (!name.trim()) { setError('Give the report a name first'); return; }
    const res = await fetch('/api/finance/report-builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, tableName, columns,
        filters: filters.filter((f) => f.field),
        sort: sortField ? { field: sortField, dir: sortDir } : undefined,
        isShared: true,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? 'Save failed'); return; }
    setName('');
    void loadSaved();
  }

  async function remove(id: string) {
    await fetch(`/api/finance/report-builder?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    void loadSaved();
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-theme-text-primary">Report Builder</h1>
        <p className="text-sm text-theme-text-secondary">
          Build read-only reports over approved business tables — pick a table, choose columns, add filters, run or save.
        </p>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">{error}</div>}

      {saved.length > 0 && (
        <div className="border border-theme-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-theme-text-primary mb-3">Saved reports</h2>
          <div className="flex flex-wrap gap-2">
            {saved.map((r) => (
              <span key={r.id} className="inline-flex items-center gap-2 border border-theme-border rounded-lg px-3 py-1.5 text-sm">
                <button onClick={() => run('runSaved', r.id)} className="text-purple-700 hover:underline" title="Run report">{r.name}</button>
                <button onClick={() => remove(r.id)} className="text-theme-text-secondary hover:text-red-600" title="Delete"><Trash2 size={13} /></button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4 lg:col-span-1">
          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-1">Report on</label>
            <select value={tableName} onChange={(e) => pickTable(e.target.value)} className="w-full border border-theme-border rounded px-3 py-2 text-sm">
              <option value="">— Choose a table —</option>
              {tables.map((t) => <option key={t.name} value={t.name}>{t.label}</option>)}
            </select>
          </div>

          {table && (
            <>
              <div>
                <label className="block text-sm font-medium text-theme-text-primary mb-2">Columns</label>
                <div className="border border-theme-border rounded-lg p-3 max-h-56 overflow-y-auto space-y-1.5">
                  {table.columns.map((c) => (
                    <label key={c} className="flex items-center gap-2 text-sm text-theme-text-primary">
                      <input type="checkbox" checked={columns.includes(c)} onChange={() => toggleCol(c)} className="rounded" />
                      <code className="text-xs">{c}</code>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-theme-text-primary">Filters</label>
                  <button onClick={() => setFilters((f) => [...f, { field: '', op: '=', value: '' }])} className="text-xs text-purple-700 hover:underline">+ add</button>
                </div>
                <div className="space-y-2">
                  {filters.map((f, i) => (
                    <div key={i} className="flex gap-1.5">
                      <select value={f.field} onChange={(e) => { const a=[...filters]; a[i]={...a[i],field:e.target.value}; setFilters(a); }} className="border border-theme-border rounded px-2 py-1 text-xs flex-1">
                        <option value="">field</option>
                        {table.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select value={f.op} onChange={(e) => { const a=[...filters]; a[i]={...a[i],op:e.target.value}; setFilters(a); }} className="border border-theme-border rounded px-1 py-1 text-xs w-24">
                        {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      {!f.op.startsWith('is_') && (
                        <input value={f.value} onChange={(e) => { const a=[...filters]; a[i]={...a[i],value:e.target.value}; setFilters(a); }} placeholder="value" className="border border-theme-border rounded px-2 py-1 text-xs w-24" />
                      )}
                      <button onClick={() => setFilters(filters.filter((_, j) => j !== i))} className="text-theme-text-secondary hover:text-red-600"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <select value={sortField} onChange={(e) => setSortField(e.target.value)} className="border border-theme-border rounded px-2 py-1.5 text-xs flex-1">
                  <option value="">Sort by…</option>
                  {table.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={sortDir} onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')} className="border border-theme-border rounded px-2 py-1.5 text-xs w-20">
                  <option value="asc">asc</option>
                  <option value="desc">desc</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => run('run')} disabled={running || columns.length === 0} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
                  <Play size={14} /> {running ? 'Running…' : 'Run'}
                </button>
              </div>
              <div className="flex gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Report name" className="flex-1 border border-theme-border rounded px-3 py-1.5 text-sm" />
                <button onClick={save} disabled={!tableName || columns.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 border border-theme-border rounded-lg text-sm text-theme-text-primary hover:bg-theme-muted disabled:opacity-50">
                  <Save size={13} /> Save
                </button>
              </div>
            </>
          )}
        </div>

        <div className="lg:col-span-2">
          {rows === null ? (
            <div className="border border-dashed border-theme-border rounded-lg p-12 text-center text-theme-text-secondary text-sm">
              Results appear here after you run a report.
            </div>
          ) : (
            <div className="border border-theme-border rounded-lg overflow-auto max-h-[70vh]">
              <table className="w-full text-sm">
                <thead className="bg-theme-muted text-left sticky top-0">
                  <tr>{columns.map((c) => <th key={c} className="px-4 py-2 font-medium"><code className="text-xs">{c}</code></th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-theme-border">
                      {columns.map((c) => (
                        <td key={c} className="px-4 py-2">{r[c] == null ? '—' : typeof r[c] === 'object' ? JSON.stringify(r[c]) : String(r[c])}</td>
                      ))}
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-theme-text-secondary">No rows match.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
