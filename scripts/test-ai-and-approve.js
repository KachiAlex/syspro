// Test script: test AI report generation and approve endpoint
// Usage: node scripts/test-ai-and-approve.js

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
    process.exit(1);
  }

  const loginData = await loginRes.json();
  console.log('Login succeeded:', loginData.user?.name, '| Role:', loginData.user?.role);
  const cookie = loginRes.headers.get('set-cookie');
  const token = cookie?.match(/employee_session=([^;]+)/)?.[1];
  if (!token) { console.error('No token'); process.exit(1); }

  // 2. Test AI generation with sectioned transcript
  console.log('\n2. Testing AI report generation...');
  const aiRes = await fetch(`${BASE}/api/hr/employees/portal/reports/generate-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': ORIGIN, 'Cookie': `employee_session=${token}` },
    body: JSON.stringify({
      transcript: `[ACTIVITIES]\nI worked on the quarterly financial report, reviewed three vendor proposals, and had a call with the client about their billing issue.\n\n[ACHIEVEMENTS]\nI completed the financial analysis ahead of schedule and got approval for the new budget.\n\n[OBJECTIVES]\nMy main objective was to finalize the Q3 report and close out the vendor selection process.\n\n[CHALLENGES]\nThe main challenge was missing data from the finance team which delayed the report.\n\n[MEETINGS]\nI had a 1-on-1 with my manager about project priorities, and a team standup where we discussed the sprint progress.\n\n[BLOCKERS]\nI'm blocked on the vendor selection because I'm waiting for the procurement team to approve the shortlist.\n\n[NEXT STEPS]\nTomorrow I'll start on the monthly reconciliation and follow up with procurement.\n\n[ADDITIONAL NOTES]\nI'd like to flag that the current reporting tool is slowing us down.`,
      reportType: 'daily',
      reportDate: new Date().toISOString().split('T')[0],
      sectioned: true,
    }),
  });

  const aiData = await aiRes.json().catch(() => ({}));
  if (aiRes.ok && aiData.success) {
    console.log('✅ AI generation succeeded!');
    console.log('   Title:', aiData.report.title);
    console.log('   Objectives:', aiData.report.objectives ? '✅ has content' : '❌ empty');
    console.log('   Achievements:', aiData.report.achievements ? '✅ has content' : '❌ empty');
    console.log('   Challenges:', aiData.report.challenges ? '✅ has content' : '❌ empty');
    console.log('   Next Steps:', aiData.report.next_steps ? '✅ has content' : '❌ empty');
    console.log('   Meetings:', aiData.report.meetings ? '✅ has content' : '❌ empty');
    console.log('   Blockers:', aiData.report.blockers ? '✅ has content' : '❌ empty');
    console.log('   Activities:', aiData.report.activities ? '✅ has content' : '❌ empty');
    console.log('   Additional Notes:', aiData.report.additional_notes ? '✅ has content' : '❌ empty');
  } else {
    console.error('❌ AI generation failed:', aiRes.status, aiData.error || aiData);
  }

  // 3. Test approve endpoint (GET)
  console.log('\n3. Testing approve endpoint (GET)...');
  const approveRes = await fetch(`${BASE}/api/hr/employees/portal/reports/approve`, {
    headers: { 'Cookie': `employee_session=${token}`, 'Origin': ORIGIN },
  });

  const approveData = await approveRes.json().catch(() => ({}));
  if (approveRes.ok) {
    console.log('✅ Approve GET succeeded!');
    console.log('   Pending reports:', approveData.pendingReports?.length || 0);
  } else {
    console.error('❌ Approve GET failed:', approveRes.status, approveData.error || approveData);
  }
}

main().catch(console.error);
