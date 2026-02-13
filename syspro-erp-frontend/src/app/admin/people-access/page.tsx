"use client";
import { useEffect, useState, useRef } from 'react';
import * as Tabs from '@radix-ui/react-tabs';

function validateEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}
function parseCSV(text: string): Array<{ email: string; name?: string }> {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const [header, ...rows] = lines;
  const headers = header.split(',').map((h) => h.trim().toLowerCase());
  return rows.map((row) => {
    const cols = row.split(',');
    const obj: any = {};
    headers.forEach((h, i) => (obj[h] = cols[i]?.trim()));
    return obj;
  });
}

type User = {
  id: string;
  email: string;
  name?: string;
  status: string;
  contractType?: string;
  createdAt?: string;
};

export default function PeopleAccessPage() {
  const [notif, setNotif] = useState<string | null>(null);
  function notify(msg: string) {
    setNotif(msg);
    setTimeout(() => setNotif(null), 3000);
  }

  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab === 'users') {
      setLoading(true);
      fetch('/api/admin/users')
        .then((r) => r.json())
        .then((d) => setUsers(d.data || []))
        .finally(() => setLoading(false));
    }
  }, [tab]);

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // CSV import state
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">People & Access</h1>
      <Tabs.Root value={tab} onValueChange={setTab} className="w-full">
        <Tabs.List className="flex gap-4 border-b mb-4">
          <Tabs.Trigger value="users" className={tab === 'users' ? 'font-bold border-b-2 border-blue-500' : ''}>Users</Tabs.Trigger>
          <Tabs.Trigger value="roles" className={tab === 'roles' ? 'font-bold border-b-2 border-blue-500' : ''}>Roles</Tabs.Trigger>
          <Tabs.Trigger value="delegation" className={tab === 'delegation' ? 'font-bold border-b-2 border-blue-500' : ''}>Delegation</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="users">
          {notif && (
            <div className="mb-2 p-2 bg-blue-100 text-blue-800 rounded">{notif}</div>
          )}
          <div className="flex gap-2 mb-4">
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              onClick={() => setInviteOpen(true)}
            >
              Invite User
            </button>
            <button
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              onClick={() => setCsvOpen(true)}
            >
              Import CSV
            </button>
          </div>
          {loading ? <div>Loading users…</div> : (
            <table className="min-w-full border text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Contract</th>
                  <th className="p-2 text-left">Created</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-2">{u.email}</td>
                    <td className="p-2">{u.name}</td>
                    <td className="p-2">{u.status}</td>
                    <td className="p-2">{u.contractType}</td>
                    <td className="p-2">{u.createdAt?.slice(0,10)}</td>
                    <td className="p-2 flex gap-2">
                      {u.status === 'invited' && (
                        <button className="text-blue-600 hover:underline" onClick={async () => {
                          // Simulate resend invite
                          notify(`Resent invite to ${u.email} (simulated email)`);
                        }}>Resend</button>
                      )}
                      {u.status !== 'inactive' && (
                        <button className="text-yellow-600 hover:underline" onClick={async () => {
                          await fetch(`/api/admin/users/${u.id}/deactivate`, { method: 'POST' });
                          setLoading(true);
                          fetch('/api/admin/users')
                            .then((r) => r.json())
                            .then((d) => setUsers(d.data || []))
                            .finally(() => setLoading(false));
                          notify(`Deactivated ${u.email}`);
                        }}>Deactivate</button>
                      )}
                      <button className="text-red-600 hover:underline" onClick={async () => {
                        await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
                        setLoading(true);
                        fetch('/api/admin/users')
                          .then((r) => r.json())
                          .then((d) => setUsers(d.data || []))
                          .finally(() => setLoading(false));
                        notify(`Deleted ${u.email}`);
                      }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Invite User Dialog */}
          {inviteOpen && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded shadow-lg p-6 w-full max-w-sm">
                <h2 className="text-lg font-bold mb-2">Invite User</h2>
                <input
                  type="email"
                  className="border p-2 w-full mb-2"
                  placeholder="user@email.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  disabled={inviteLoading}
                />
                {!validateEmail(inviteEmail) && inviteEmail && (
                  <div className="text-red-600 text-xs mb-1">Invalid email address</div>
                )}
                {inviteError && <div className="text-red-600 text-sm mb-2">{inviteError}</div>}
                <div className="flex gap-2 justify-end">
                  <button className="px-3 py-1" onClick={() => setInviteOpen(false)} disabled={inviteLoading}>Cancel</button>
                  <button
                    className="bg-blue-600 text-white px-4 py-1 rounded"
                    disabled={inviteLoading || !validateEmail(inviteEmail)}
                    onClick={async () => {
                      setInviteLoading(true);
                      setInviteError('');
                      try {
                        const res = await fetch('/api/admin/users', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: inviteEmail })
                        });
                        if (!res.ok) throw new Error('Failed to invite user');
                        setInviteOpen(false);
                        setInviteEmail('');
                        setLoading(true);
                        fetch('/api/admin/users')
                          .then((r) => r.json())
                          .then((d) => setUsers(d.data || []))
                          .finally(() => setLoading(false));
                        notify('Invitation sent (simulated email)');
                      } catch (e: any) {
                        setInviteError(e.message || 'Error inviting user');
                      } finally {
                        setInviteLoading(false);
                      }
                    }}
                  >Invite</button>
                </div>
              </div>
            </div>
          )}

          {/* CSV Import Dialog */}
          {csvOpen && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded shadow-lg p-6 w-full max-w-sm">
                <h2 className="text-lg font-bold mb-2">Import Users from CSV</h2>
                <input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  className="mb-2"
                  disabled={csvLoading}
                  onChange={async (e) => {
                    setCsvError('');
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setCsvLoading(true);
                    try {
                      const text = await file.text();
                      const users = parseCSV(text).filter(u => validateEmail(u.email));
                      if (users.length === 0) throw new Error('No valid emails in CSV');
                      const res = await fetch('/api/admin/users', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ users })
                      });
                      if (!res.ok) throw new Error('Failed to import users');
                      setCsvOpen(false);
                      setLoading(true);
                      fetch('/api/admin/users')
                        .then((r) => r.json())
                        .then((d) => setUsers(d.data || []))
                        .finally(() => setLoading(false));
                      notify('CSV import complete (simulated email sent)');
                      {/* User management actions: deactivate, resend, delete handled in Actions column above */}
                    } catch (e: any) {
                      setCsvError(e.message || 'Error importing CSV');
                    } finally {
                      setCsvLoading(false);
                    }
                  }}
                />
                <div className="text-xs text-gray-500 mb-2">CSV must have columns: email,name</div>
                {csvError && <div className="text-red-600 text-sm mb-2">{csvError}</div>}
                <div className="flex gap-2 justify-end">
                  <button className="px-3 py-1" onClick={() => setCsvOpen(false)} disabled={csvLoading}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </Tabs.Content>
        <Tabs.Content value="roles">
          <div>Roles management coming soon…</div>
        </Tabs.Content>
        <Tabs.Content value="delegation">
          <div>Delegation & acting roles coming soon…</div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}