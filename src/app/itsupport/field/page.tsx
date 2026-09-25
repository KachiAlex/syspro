"use client";
import { useEffect, useState } from 'react';

type FieldJob = {
  id: string;
  ticketId: string;
  engineerId: string;
  assignedAt: string;
  startedAt?: string;
  arrivedAt?: string;
  completedAt?: string;
  workLog?: string;
  images?: string[];
  customerSignoff?: boolean;
};

export default function ITSupportFieldEngineerUI() {
  const [jobs, setJobs] = useState<FieldJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [log, setLog] = useState('');
  const [signingOff, setSigningOff] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  useEffect(() => {
    setLoading(true);
    fetch('/api/itsupport/fieldjobs')
      .then((r) => r.json())
      .then((d) => setJobs(d.data || []))
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

  async function handleImageUpload(jobId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setUploadError('Image must be under 4MB');
      return;
    }
    setUploadError(null);
    setUploading(jobId);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/itsupport/fieldjobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (!res.ok) throw new Error('Upload failed');
      const { data } = await res.json();
      setJobs(jobs => jobs.map(j => j.id === jobId ? { ...j, images: data.images } : j));
    } catch {
      setUploadError('Image upload failed');
    } finally {
      setUploading(null);
    }
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
      {uploadError && <div className="mb-3 p-2 bg-red-50 text-red-700 rounded text-sm">{uploadError}</div>}
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
                <label className="bg-blue-600 text-white px-3 py-1 rounded cursor-pointer">
                  {uploading === job.id ? "Uploading…" : "Upload Image"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={uploading === job.id}
                    onChange={(e) => handleImageUpload(job.id, e)}
                  />
                </label>
                <button
                  className="bg-green-600 text-white px-3 py-1 rounded"
                  onClick={() => handleSignOff(job.id)}
                  disabled={job.customerSignoff || signingOff}
                >Customer Sign-off</button>
              </div>
              {job.images && job.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {job.images.map((src, idx) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={idx} src={src} alt={`Job evidence ${idx + 1}`} className="w-20 h-20 object-cover rounded border" />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}