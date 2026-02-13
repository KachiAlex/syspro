import { useEffect, useState } from 'react';

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
  useEffect(() => {
    setLoading(true);
    fetch('/api/itsupport/tickets')
      .then((r) => r.json())
      .then((d) => setTickets((d.data || []).filter((t: Ticket) => t.assignedTo === AGENT_ID)))
      .finally(() => setLoading(false));
  }, []);

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