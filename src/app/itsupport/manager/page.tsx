"use client";
import { useEffect, useState } from 'react';

type Ticket = {
  id: string;
  status: string;
  createdAt: string;
  slaResponseDue: string;
  slaResolutionDue: string;
  escalationLevel?: string;
  assignedTo?: string;
};
type Engineer = {
  id: string;
  name: string;
  workload: number;
  performanceScore: number;
};

function countSlaBreaches(tickets: Ticket[]) {
  const now = Date.now();
  return tickets.filter(
    t => new Date(t.slaResolutionDue).getTime() < now && t.status !== 'resolved' && t.status !== 'closed'
  ).length;
}

export default function ITSupportManagerDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/itsupport/tickets').then(r => r.json()),
      fetch('/api/itsupport/engineers').then(r => r.json()),
    ]).then(([t, e]) => {
      setTickets(t.data || []);
      setEngineers(e.data || []);
    }).finally(() => setLoading(false));
  }, []);

  // Ticket volume trend (last 7 days)
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const dailyCounts = days.map(day =>
    tickets.filter(t => t.createdAt.slice(0, 10) === day).length
  );
  const slaBreaches = countSlaBreaches(tickets);
  const openTickets = tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">IT Support Manager Dashboard</h1>
      {loading ? <div>Loading…</div> : (
        <>
          <div className="mb-4">
            <span className="font-semibold">Ticket Volume (Last 7 Days):</span>
            <div className="flex gap-2 mt-2">
              {days.map((d, i) => (
                <div key={d} className="flex flex-col items-center">
                  <span className="text-xs text-gray-500">{d.slice(5)}</span>
                  <span className="font-bold">{dailyCounts[i]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <span className="font-semibold">SLA Breaches:</span> <span className={slaBreaches > 0 ? 'text-red-600 font-bold' : ''}>{slaBreaches}</span>
            <span className="ml-6 font-semibold">Open Tickets:</span> <span>{openTickets}</span>
          </div>
          <div className="mb-4">
            <span className="font-semibold">Engineer Performance</span>
            <table className="min-w-full border text-sm mt-2">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Workload</th>
                  <th className="p-2 text-left">Performance</th>
                </tr>
              </thead>
              <tbody>
                {engineers.map(e => (
                  <tr key={e.id} className="border-t">
                    <td className="p-2">{e.name}</td>
                    <td className="p-2">{e.workload}</td>
                    <td className="p-2">{e.performanceScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}