"use client";
import { useEffect, useState } from 'react';

type Monitoring = {
  uptime: number;
  outages: number;
  incidents: number;
  lastIncident?: { id: string; detectedAt: string; resolvedAt?: string; description: string; severity: string };
};
type Ticket = { id: string; status: string; slaResolutionDue: string };

function countSlaBreaches(tickets: Ticket[]) {
  const now = Date.now();
  return tickets.filter(
    t => new Date(t.slaResolutionDue).getTime() < now && t.status !== 'resolved' && t.status !== 'closed'
  ).length;
}

export default function ITSupportExecutiveDashboard() {
  const [monitoring, setMonitoring] = useState<Monitoring | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/itsupport/monitoring').then(r => r.json()),
      fetch('/api/itsupport/tickets').then(r => r.json()),
    ]).then(([m, t]) => {
      setMonitoring(m.data);
      setTickets(t.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const slaBreaches = countSlaBreaches(tickets);
  // Example: cost of downtime = $1000 per breach (customize as needed)
  const costOfDowntime = slaBreaches * 1000;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">IT Support Executive Dashboard</h1>
      {loading ? <div>Loading…</div> : monitoring && (
        <>
          <div className="mb-4">
            <span className="font-semibold">Uptime:</span> <span className="text-green-700 font-bold">{monitoring.uptime}%</span>
            <span className="ml-6 font-semibold">Outages:</span> <span>{monitoring.outages}</span>
            <span className="ml-6 font-semibold">Incidents:</span> <span>{monitoring.incidents}</span>
          </div>
          <div className="mb-4">
            <span className="font-semibold">SLA Breaches:</span> <span className={slaBreaches > 0 ? 'text-red-600 font-bold' : ''}>{slaBreaches}</span>
            <span className="ml-6 font-semibold">Cost of Downtime:</span> <span className="text-orange-700 font-bold">${costOfDowntime}</span>
          </div>
          {monitoring.lastIncident && (
            <div className="mb-4">
              <span className="font-semibold">Last Incident:</span> <span>{monitoring.lastIncident.description}</span>
              <span className="ml-4">Severity: <span className="font-bold">{monitoring.lastIncident.severity}</span></span>
              <span className="ml-4">Detected: {new Date(monitoring.lastIncident.detectedAt).toLocaleString()}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}