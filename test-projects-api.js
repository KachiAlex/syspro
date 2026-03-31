// Simple test to verify Projects API integration
const fetch = require('node-fetch');

async function testProjectsAPI() {
  try {
    console.log('Testing Projects API...');
    
    // Test GET /api/projects
    const getResponse = await fetch('http://localhost:3000/api/projects?tenantSlug=default');
    const getData = await getResponse.json();
    console.log('GET /api/projects response:', getData);
    
    // Test POST /api/projects
    const projectData = {
      name: 'Test Project',
      objective: 'Test objective',
      description: 'Test description',
      subsidiary: 'Test Subsidiary',
      branch: 'Test Branch',
      departments: ['Engineering', 'Marketing'],
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      budgetApproved: 100000,
      owner: 'Test Owner',
      priority: 'High',
      status: 'Active'
    };
    
    const postResponse = await fetch('http://localhost:3000/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectData),
    });
    const postData = await postResponse.json();
    console.log('POST /api/projects response:', postData);
    
  } catch (error) {
    console.error('Error testing Projects API:', error);
  }
}

testProjectsAPI();
