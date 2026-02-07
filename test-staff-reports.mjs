// Test script for staff reports functionality
const testStaffReports = async () => {
  const baseUrl = 'http://localhost:3000';

  try {
    console.log('Testing staff reports functionality...');

    // Test submitting a report
    const submitResponse = await fetch(`${baseUrl}/api/hr/staff-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantSlug: 'kreatix-default',
        employeeId: 'user-1770284257163',
        reportType: 'daily',
        reportDate: '2026-01-29',
        objectives: 'Complete daily tasks and review project progress',
        achievements: 'Successfully completed all assigned tasks',
        challenges: 'Minor technical issues with the system',
        nextSteps: 'Continue with next phase of development',
        additionalNotes: 'Good progress overall',
        headOfDepartment: 'hod-001',
        teamMembers: ['user-1770284528300', 'user-1770284621483'],
      }),
    });

    if (!submitResponse.ok) {
      throw new Error(`Failed to submit report: ${submitResponse.status}`);
    }

    const submitResult = await submitResponse.json();
    console.log('✓ Report submitted successfully:', submitResult.report.id);

    // Test fetching reports
    const fetchResponse = await fetch(`${baseUrl}/api/hr/staff-reports?tenantSlug=kreatix-default`);
    if (!fetchResponse.ok) {
      throw new Error(`Failed to fetch reports: ${fetchResponse.status}`);
    }

    const fetchResult = await fetchResponse.json();
    console.log('✓ Reports fetched successfully, count:', fetchResult.reports.length);

    // Test updating report status
    const reportId = submitResult.report.id;
    const updateResponse = await fetch(`${baseUrl}/api/hr/staff-reports`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reportId,
        status: 'reviewed',
        tenantSlug: 'kreatix-default',
      }),
    });

    if (!updateResponse.ok) {
      throw new Error(`Failed to update report status: ${updateResponse.status}`);
    }

    const updateResult = await updateResponse.json();
    console.log('✓ Report status updated successfully:', updateResult.report.status);

    // Test AI draft generation
    const aiResponse = await fetch(`${baseUrl}/api/hr/staff-reports/ai-draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript: 'Objectives: finish onboarding flow. Achievements: shipped expense widget. Challenges: delayed vendor data. Next steps: align with HR.',
        reportType: 'daily',
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`Failed to generate AI draft: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    console.log('✓ AI draft generated objectives snippet:', aiResult.reportDraft.objectives.slice(0, 50));
    if (aiResult.metadata) {
      console.log('   Source:', aiResult.metadata.source, 'Model:', aiResult.metadata.model || 'fallback');
    }

    console.log('All tests passed! 🎉');

  } catch (error) {
    console.error('Test failed:', error);
  }
};

testStaffReports();