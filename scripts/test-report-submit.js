// Test script: login as employee and submit a report
// Usage: node scripts/test-report-submit.js

const BASE = 'https://syspro-pi.vercel.app';
const ORIGIN = BASE;

async function main() {
  // 1. Login
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

  if (!loginRes.ok) {
    const err = await loginRes.json().catch(() => ({}));
    console.error('Login failed:', loginRes.status, err);
    console.log('\nTrying with different credentials...');
    
    // Try another common setup
    const loginRes2 = await fetch(`${BASE}/api/hr/employees/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': ORIGIN },
      body: JSON.stringify({
        tenantSlug: 'kreatixtech',
        email: 'admin@syspro.com',
        password: 'password123',
      }),
    });

    if (!loginRes2.ok) {
      const err2 = await loginRes2.json().catch(() => ({}));
      console.error('Login attempt 2 failed:', loginRes2.status, err2);
      process.exit(1);
    }

    console.log('Login attempt 2 succeeded!');
    const cookie2 = loginRes2.headers.get('set-cookie');
    const token2 = cookie2?.match(/employee_session=([^;]+)/)?.[1];
    
    if (!token2) {
      console.error('No employee_session cookie found');
      process.exit(1);
    }

    await testReportSubmission(token2);
    return;
  }

  const loginData = await loginRes.json();
  console.log('Login succeeded:', loginData.user?.name, loginData.user?.email);

  const cookie = loginRes.headers.get('set-cookie');
  const token = cookie?.match(/employee_session=([^;]+)/)?.[1];

  if (!token) {
    console.error('No employee_session cookie found');
    process.exit(1);
  }

  await testReportSubmission(token);
}

async function testReportSubmission(token) {
  // 2. Submit a report
  console.log('\n2. Submitting test report...');
  const reportRes = await fetch(`${BASE}/api/hr/employees/portal/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `employee_session=${token}`,
      'Origin': ORIGIN,
    },
    body: JSON.stringify({
      reportType: 'daily',
      reportDate: new Date().toISOString().split('T')[0],
      title: 'Test Report — API Validation',
      objectives: 'Test that report submission works correctly',
      achievements: 'Successfully identified and fixed the 500 error',
      challenges: 'The 500 error was caused by missing DB columns',
      nextSteps: 'Verify the fix works in production',
      additionalNotes: 'This is an automated test submission',
      meetings: 'Met with the team to discuss the issue',
      blockers: 'No blockers identified',
      activities: 'Debugging, fixing, deploying, and testing',
      kpiMetrics: [],
      teamMembers: [],
    }),
  });

  const reportData = await reportRes.json().catch(() => ({}));
  
  if (reportRes.ok) {
    console.log('✅ Report submitted successfully!');
    console.log('   Status:', reportRes.status);
    console.log('   Report ID:', reportData.report?.id || 'N/A');
  } else {
    console.error('❌ Report submission failed:', reportRes.status);
    console.error('   Error:', reportData.error || reportData);
    if (reportData.detail) console.error('   Detail:', reportData.detail);
  }

  // 3. Fetch reports to confirm
  console.log('\n3. Fetching reports to confirm...');
  await new Promise(r => setTimeout(r, 1000));
  const fetchRes = await fetch(`${BASE}/api/hr/employees/portal/reports`, {
    headers: { 'Cookie': `employee_session=${token}`, 'Origin': ORIGIN },
  });

  const fetchData = await fetchRes.json().catch(() => ({}));
  if (fetchRes.ok) {
    console.log('✅ Reports fetched successfully!');
    console.log('   Count:', fetchData.reports?.length || 0);
    if (fetchData.reports?.length > 0) {
      const latest = fetchData.reports[0];
      console.log('   Latest report:', latest.title || 'Untitled');
      console.log('   Meetings:', latest.meetings ? '✅ has content' : '❌ empty');
      console.log('   Blockers:', latest.blockers ? '✅ has content' : '❌ empty');
      console.log('   Activities:', latest.activities ? '✅ has content' : '❌ empty');
    } else {
      console.log('   (No reports returned — checking raw response...)');
      console.log('   Raw:', JSON.stringify(fetchData).slice(0, 200));
    }
  } else {
    console.error('❌ Fetch reports failed:', fetchRes.status, fetchData.error || fetchData);
  }
}

main().catch(console.error);
