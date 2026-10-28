'use client';

import React, { useEffect, useState } from 'react';
import { GitMerge } from 'lucide-react';

type Doc = { id: string; name: string; code?: string; customer_code?: string; merged_into?: string };

export default function MergeDocumentsPage() {
  const [docType, setDocType] = useState<'customer' | 'vendor'>('customer');
  const [options, setOptions] = useState<Doc[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadOptions() {
    const url = docType === 'customer' ? '/api/finance/customers' : '/api/finance/vendors';
    const d = await fetch(url).then((r) => r.json()).catch(() => ({}));
    setOptions((d.customers ?? d.vendors ?? d.data ?? []).filter((x: Doc) => !x.merged_into));
    setSourceId('');
    setTargetId('');
  }

  async function loadHistory() {
    const d = await fetch('/api/finance/merge').then((r) => r.json()).catch(() => ({}));
    setHistory(d.merges ?? []);
  }

  useEffect(() => { void loadOptions(); void loadHistory(); }, [docType]);

  const source = options.find((o) => o.id === sourceId);
  const target = options.find((o) => o.id === targetId);

  async function submit() {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch('/api/finance/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType, sourceId, targetId }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 202) {
        setResult(`Sent for approval — the merge applies once the chain signs off.`);
      } else if (!res.ok) {
        throw new Error(d.error ?? 'Merge failed');
      } else {
        setResult(`Merged — ${Object.keys(d.merged?.rewrote ?? {}).length} reference table(s) rewritten.`);
      }
      void loadOptions(); void loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-theme-text-primary">Merge Documents</h1>
        <p className="text-sm text-theme-text-secondary">
          Consolidate a duplicate customer or vendor into the real record — every invoice,
          order, payment and contact moves to the target. The source is kept as history,
          marked merged. This always requires approval before it runs.
        </p>
      </div>

      <div className="border border-theme-border rounded-lg p-5 space-y-4">
        <div className="flex gap-2">
          {(['customer', 'vendor'] as const).map((t) => (
            <button
              key={t} onClick={() => setDocType(t)}
              className={`px-3 py-1.5 rounded-lg text-sm ${docType === t ? 'bg-purple-600 text-white' : 'border border-theme-border text-theme-text-primary'}`}
            >{t === 'customer' ? 'Customers' : 'Vendors'}</button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-1">Duplicate to absorb</label>
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="w-full border border-theme-border rounded px-3 py-2 text-sm">
              <option value="">— Pick the record going away —</option>
              {options.filter((o) => o.id !== targetId).map((o) => (
                <option key={o.id} value={o.id}>{o.name}{o.customer_code || o.code ? ` (${o.customer_code ?? o.code})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-1">Keep this record</label>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full border border-theme-border rounded px-3 py-2 text-sm">
              <option value="">— Pick the surviving record —</option>
              {options.filter((o) => o.id !== sourceId).map((o) => (
                <option key={o.id} value={o.id}>{o.name}{o.customer_code || o.code ? ` (${o.customer_code ?? o.code})` : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {source && target && (
          <div className="p-3 rounded-lg bg-amber-50 text-amber-900 text-sm">
            Everything pointing at <strong>{source.name}</strong> will move to <strong>{target.name}</strong>.
            This cannot be undone — the request goes through approvals first.
          </div>
        )}

        {error && <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">{error}</div>}
        {result && <div className="p-3 rounded-lg bg-green-50 text-green-800 text-sm">{result}</div>}

        <div className="flex justify-end">
          <button
            onClick={submit} disabled={loading || !sourceId || !targetId}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
          >
            <GitMerge size={15} /> {loading ? 'Submitting…' : 'Request merge'}
          </button>
        </div>
      </div>

      {history.length > 0 && (
        <div className="border border-theme-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-theme-muted text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Merged</th>
                <th className="px-4 py-2 font-medium">Tables rewritten</th>
                <th className="px-4 py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {history.map((m) => (
                <tr key={m.id} className="border-t border-theme-border">
                  <td className="px-4 py-2 capitalize">{m.doc_type}</td>
                  <td className="px-4 py-2 font-mono text-xs">{String(m.source_id).slice(0, 8)} → {String(m.target_id).slice(0, 8)}</td>
                  <td className="px-4 py-2">{Object.keys(m.rewrote ?? {}).length || '—'}</td>
                  <td className="px-4 py-2">{String(m.created_at).slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
