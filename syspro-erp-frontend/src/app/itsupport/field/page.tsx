"use client";
import { useEffect, useState } from 'react';

type FieldJob = {
  id: string;
  ticketId: string;
  assignedAt: string;
  startedAt?: string;
  arrivedAt?: string;
  completedAt?: string;
  workLog?: string;
  images?: string[];
  customerSignoff?: boolean;
};

const ENGINEER_ID = 'engineer-1'; // TODO: Replace with real auth/user context

export default function ITSupportFieldEngineerUI() {
  const [jobs, setJobs] = useState<FieldJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [log, setLog] = useState('');
  const [signingOff, setSigningOff] = useState(false);
  useEffect(() => {
    setLoading(true);
    fetch('/api/itsupport/fieldjobs')
      .then((r) => r.json())
      .then((d) => setJobs((d.data || []).filter((j: FieldJob) => j.engineerId === ENGINEER_ID)))
      .finally(() => setLoading(false));
  }, []);

  async function handleSignOff(jobId: string) {
    setSigningOff(true);
    await fetch(`/api/itsupport/fieldjobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerSignoff: true }),
    });
    setJobs(jobs => jobs.map(j => j.id === jobId ? { ...j, customerSignoff: true } : j));
    setSigningOff(false);
  }

  async function handleWorkLog(jobId: string) {
    await fetch(`/api/itsupport/fieldjobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workLog: log }),
    });
    setJobs(jobs => jobs.map(j => j.id === jobId ? { ...j, workLog: log } : j));
    setLog('');
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Field Engineer Mobile UI</h1>
      {loading ? <div>Loading…</div> : jobs.length === 0 ? <div>No jobs assigned.</div> : (
        <div className="space-y-6">
          {jobs.map(job => (
            <div key={job.id} className="border rounded p-4 bg-white shadow">
              <div className="font-semibold mb-2">Job ID: {job.id}</div>
              <div className="mb-1">Assigned: {new Date(job.assignedAt).toLocaleString()}</div>
              <div className="mb-1">Status: {job.completedAt ? 'Completed' : job.arrivedAt ? 'On Site' : 'Assigned'}</div>
              <div className="mb-1">Work Log: {job.workLog || <span className="text-gray-400">None</span>}</div>
              <div className="mb-1">Customer Sign-off: {job.customerSignoff ? <span className="text-green-700 font-bold">Yes</span> : 'No'}</div>
              <div className="mb-2">Images: {job.images && job.images.length > 0 ? job.images.length : 0}</div>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  className="border p-1 flex-1"
                  placeholder="Add work log..."
                  value={log}
                  onChange={e => setLog(e.target.value)}
                />
                <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={() => handleWorkLog(job.id)} disabled={!log}>Save Log</button>
              </div>
              <div className="flex gap-2 mb-2">
                <button className="bg-gray-300 px-3 py-1 rounded" disabled>Upload Image (stub)</button>
                <button
                  className="bg-green-600 text-white px-3 py-1 rounded"
                  onClick={() => handleSignOff(job.id)}
                  disabled={job.customerSignoff || signingOff}
                >Customer Sign-off</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}