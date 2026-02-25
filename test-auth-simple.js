// Simple authentication test without imports
async function testAuth() {
  try {
    console.log('Testing authentication fixes...\n');

    // Test 1: Health endpoint (no auth required)
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch('http://localhost:3000/api/health');
    const healthData = await healthResponse.json();
    console.log('Health:', healthData.status, healthResponse.status);

    // Test 2: User permissions endpoint with dev auth headers
    console.log('\n2. Testing user permissions with dev auth headers...');
    const devHeaders = {
      'X-User-Id': 'dev-user-123',
      'X-User-Email': 'dev@example.com',
      'X-User-Name': 'Development User',
      'X-Tenant-Slug': 'kreatix-default',
      'X-Role-Id': 'admin',
    };
    
    const permResponse = await fetch('http://localhost:3000/api/tenant/user-permissions?tenantSlug=kreatix-default', {
      headers: devHeaders
    });
    
    console.log('Permissions status:', permResponse.status);
    if (permResponse.ok) {
      const permData = await permResponse.json();
      console.log('✅ User permissions loaded for:', permData.permissions?.userId);
      console.log('   Role:', permData.permissions?.role);
      console.log('   Tenant:', permData.permissions?.tenantSlug);
    } else {
      const errorData = await permResponse.text();
      console.log('❌ Error:', errorData);
    }

    // Test 3: Test with query parameters
    console.log('\n3. Testing with query parameters...');
    const queryResponse = await fetch('http://localhost:3000/api/tenant/user-permissions?userId=dev-user-123&userEmail=dev@example.com&tenantSlug=kreatix-default&roleId=admin');
    
    console.log('Query auth status:', queryResponse.status);
    if (queryResponse.ok) {
      const queryData = await queryResponse.json();
      console.log('✅ Query auth successful for:', queryData.permissions?.userId);
    } else {
      const errorData = await queryResponse.text();
      console.log('❌ Query auth error:', errorData);
    }

    // Test 4: Test without any auth (should fallback to dev user)
    console.log('\n4. Testing without auth headers (development fallback)...');
    const noAuthResponse = await fetch('http://localhost:3000/api/tenant/user-permissions?tenantSlug=kreatix-default');
    
    console.log('No auth status:', noAuthResponse.status);
    if (noAuthResponse.ok) {
      const noAuthData = await noAuthResponse.json();
      console.log('✅ Development fallback successful for:', noAuthData.permissions?.userId);
    } else {
      const errorData = await noAuthResponse.text();
      console.log('❌ No auth error:', errorData);
    }

    console.log('\n🎉 Authentication tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testAuth();
