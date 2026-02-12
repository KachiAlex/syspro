import React, { useEffect, useState } from 'react';

export default function MarketingSalesDashboard() {
  const [summary, setSummary] = useState<any>(null);
  useEffect(() => {
    fetch('/api/marketing/attribution?model=first_touch', { headers: { 'x-tenant': 'default' } })
      .then((r) => r.json())
      .then(setSummary)
      .catch((e) => console.error(e));
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold">Marketing & Sales — Revenue Intelligence</h2>
      <p className="text-sm text-slate-400">High-level attribution snapshot</p>
      <div className="mt-4">
        {summary ? (
          <pre className="whitespace-pre-wrap text-xs bg-slate-900 p-4 rounded">{JSON.stringify(summary, null, 2)}</pre>
        ) : (
          <div>Loading...</div>
        )}
      </div>
    </div>
  );
}
