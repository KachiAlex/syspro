// Test script: test new employee portal features (tasks, expenses, leave, payslips)
const BASE = 'https://syspro-pi.vercel.app';
const ORIGIN = BASE;

async function main() {
  // Login
  console.log('1. Logging in...');
  const loginRes = await fetch(`${BASE}/api/hr/employees/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': ORIGIN },
    body: JSON.stringify({
      tenantSlug: 'kreatixtech',
      email: 'onyedika.akoma@gmail.com',
      password: 'dikaoliver2660',
    }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok) { console.error('Login failed:', loginData); process.exit(1); }
  console.log('   Login:', loginData.user.name, '| Role:', loginData.user.role);
  const cookie = loginRes.headers.get('set-cookie');
  const token = cookie?.match(/employee_session=([^;]+)/)?.[1];

  const headers = { 'Content-Type': 'application/json', 'Origin': ORIGIN, 'Cookie': `employee_session=${token}` };

  // 2. Test Tasks API
  console.log('\n2. Testing Tasks API (GET)...');
  const tasksRes = await fetch(`${BASE}/api/hr/employees/portal/tasks`, { headers });
  const tasksData = await tasksRes.json().catch(() => ({}));
  if (tasksRes.ok) {
    console.log('   ✅ Tasks loaded:', tasksData.tasks?.length, 'tasks | isHOD:', tasksData.isHOD);
  } else {
    console.error('   ❌ Tasks failed:', tasksRes.status, tasksData.error);
  }

  // 3. Test Task Assignment (HOD)
  console.log('\n3. Testing Task Assignment (POST)...');
  const assignRes = await fetch(`${BASE}/api/hr/employees/portal/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      employeeId: loginData.user.id,
      title: 'Test KPI: Complete monthly report',
      description: 'Complete and submit the monthly activity report on time',
      expectedOutcome: 'Submitted report with all sections filled',
      weight: 3,
      isKpi: true,
      frequency: 'monthly',
      dueDate: '2026-08-31',
    }),
  });
  const assignData = await assignRes.json().catch(() => ({}));
  if (assignRes.ok) {
    console.log('   ✅ Task assigned! ID:', assignData.id);
  } else {
    console.error('   ❌ Assign failed:', assignRes.status, assignData.error);
  }

  // 4. Test Expenses API
  console.log('\n4. Testing Expenses API (GET)...');
  const expRes = await fetch(`${BASE}/api/hr/employees/portal/expenses`, { headers });
  const expData = await expRes.json().catch(() => ({}));
  if (expRes.ok) {
    console.log('   ✅ Expenses loaded:', expData.expenses?.length, 'expenses | pending approvals:', expData.pendingApprovals?.length);
  } else {
    console.error('   ❌ Expenses failed:', expRes.status, expData.error);
  }

  // 5. Test Expense Submission
  console.log('\n5. Testing Expense Submission (POST)...');
  const expSubmitRes = await fetch(`${BASE}/api/hr/employees/portal/expenses`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      category: 'Travel',
      description: 'Taxi to client meeting in Lekki',
      amount: 5000,
      date: new Date().toISOString().split('T')[0],
    }),
  });
  const expSubmitData = await expSubmitRes.json().catch(() => ({}));
  if (expSubmitRes.ok) {
    console.log('   ✅ Expense submitted! ID:', expSubmitData.id);
  } else {
    console.error('   ❌ Expense submit failed:', expSubmitRes.status, expSubmitData.error);
  }

  // 6. Test Leave API
  console.log('\n6. Testing Leave API (GET)...');
  const leaveRes = await fetch(`${BASE}/api/hr/employees/portal/leave`, { headers });
  const leaveData = await leaveRes.json().catch(() => ({}));
  if (leaveRes.ok) {
    console.log('   ✅ Leave loaded:', leaveData.requests?.length, 'requests');
  } else {
    console.error('   ❌ Leave failed:', leaveRes.status, leaveData.error);
  }

  // 7. Test Leave Submission
  console.log('\n7. Testing Leave Submission (POST)...');
  const leaveSubmitRes = await fetch(`${BASE}/api/hr/employees/portal/leave`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      leaveType: 'sick',
      startDate: '2026-07-25',
      endDate: '2026-07-26',
      reason: 'Medical appointment',
    }),
  });
  const leaveSubmitData = await leaveSubmitRes.json().catch(() => ({}));
  if (leaveSubmitRes.ok) {
    console.log('   ✅ Leave submitted! ID:', leaveSubmitData.id);
  } else {
    console.error('   ❌ Leave submit failed:', leaveSubmitRes.status, leaveSubmitData.error);
  }

  // 8. Test Payslips API
  console.log('\n8. Testing Payslips API (GET)...');
  const payslipRes = await fetch(`${BASE}/api/hr/employees/portal/payslips`, { headers });
  const payslipData = await payslipRes.json().catch(() => ({}));
  if (payslipRes.ok) {
    console.log('   ✅ Payslips loaded:', payslipData.payslips?.length, 'payslips');
  } else {
    console.error('   ❌ Payslips failed:', payslipRes.status, payslipData.error);
  }

  console.log('\n✅ All API tests complete!');
}

main().catch(console.error);
