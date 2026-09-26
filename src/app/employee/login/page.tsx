import { redirect } from 'next/navigation';

export default function EmployeeLoginPage({ searchParams }: { searchParams: { redirect?: string } }) {
  const target = searchParams?.redirect;
  // Forward only internal absolute paths; otherwise land on plain /login.
  const safe = target && target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/\\')
    ? target
    : null;
  redirect(safe ? `/login?redirect=${encodeURIComponent(safe)}` : '/login');
}
