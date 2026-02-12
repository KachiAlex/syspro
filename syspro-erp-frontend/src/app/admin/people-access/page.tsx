import { useEffect, useState } from 'react';
import { Tabs, Tab } from '@radix-ui/react-tabs';

type User = {
  id: string;
  email: string;
  name?: string;
  status: string;
  contractType?: string;
  createdAt?: string;
};

export default function PeopleAccessPage() {
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
          {loading ? <div>Loading users…</div> : (
            <table className="min-w-full border text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Contract</th>
                  <th className="p-2 text-left">Created</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
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