import { useEffect, useState, useMemo } from 'react';

type Ticket = {
  id: string;
  title: string;
  status: string;
  slaResponseDue: string;
  slaResolutionDue: string;
  escalationLevel?: string;
  assignedTo?: string;
};

const AGENT_ID = 'agent-1'; // TODO: Replace with real auth/user context

function getTimeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return 'BREACHED';
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

export default function ITSupportAgentDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [polling, setPolling] = useState(true);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const r = await fetch('/api/itsupport/tickets');
        const d = await r.json();
        if (cancelled) return;
        setTickets((d.data || []).filter((t: Ticket) => t.assignedTo === AGENT_ID));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to load tickets', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    if (!polling) return () => { cancelled = true; };
    const iv = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [polling]);

  const statuses = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach((t) => { map[t.status] = (map[t.status] || 0) + 1; });
    return Object.entries(map).map(([k, v]) => ({ status: k, count: v }));
  }, [tickets]);

  const filteredTickets = useMemo(() => tickets.filter(t => statusFilter === 'all' || t.status === statusFilter), [tickets, statusFilter]);

  function StatusBarChart({data}:{data:{status:string;count:number}[]}){
    const total = data.reduce((s,d)=>s+d.count,0) || 1;
    return (
      <svg width="100%" height={40} viewBox={`0 0 100 ${40}`} preserveAspectRatio="none">
        {data.reduce((acc, d, i) => {
          const prev = acc.sum;
          const w = (d.count / total) * 100;
          acc.elems.push(
            <rect key={d.status} x={prev} y={5} width={w} height={30} fill={['#34D399','#60A5FA','#FBBF24','#F87171'][i%4]} />
          );
          acc.sum += w;
          return acc;
        }, {sum:0, elems:[] as any}).elems}
      </svg>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">IT Support Agent Dashboard</h1>
      <div className="mb-4">
        <span className="font-semibold">Assigned Tickets</span>
      </div>
      {loading ? (
        <div>Loading…</div>
      ) : tickets.length === 0 ? (
        <div>No tickets assigned.</div>
      ) : (
        <table className="min-w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">Title</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">SLA Response</th>
              <th className="p-2 text-left">SLA Resolution</th>
              <th className="p-2 text-left">Escalation</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-2">{t.title}</td>
                <td className="p-2">{t.status}</td>
                <td className={getTimeLeft(t.slaResponseDue) === 'BREACHED' ? 'p-2 text-red-600' : 'p-2'}>
                  {getTimeLeft(t.slaResponseDue)}
                </td>
                <td className={getTimeLeft(t.slaResolutionDue) === 'BREACHED' ? 'p-2 text-red-600' : 'p-2'}>
                  {getTimeLeft(t.slaResolutionDue)}
                </td>
                <td className={t.escalationLevel ? 'p-2 text-orange-600' : 'p-2'}>
                  {t.escalationLevel ? t.escalationLevel : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {/* TODO: Add knowledge base suggestions */}
    </div>
  );
}