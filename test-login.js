// Test the login functionality
async function testLogin() {
  try {
    console.log('Testing tenant login routing...\n');

    // Test if tenant-admin route exists
    const response = await fetch('http://localhost:3000/tenant-admin');
    
    if (response.ok) {
      console.log('✅ Tenant admin route exists and is accessible');
      console.log('Status:', response.status);
      
      // Check if it's the login page or dashboard
      const text = await response.text();
      if (text.includes('tenant-signin') || text.includes('Sign In')) {
        console.log('ℹ️  Tenant admin route redirects to sign-in (expected behavior)');
      } else {
        console.log('ℹ️  Tenant admin dashboard appears to be directly accessible');
      }
    } else {
      console.log('❌ Tenant admin route not accessible:', response.status);
    }

    // Test access page
    const accessResponse = await fetch('http://localhost:3000/access');
    console.log('\n📄 Access page status:', accessResponse.status);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testLogin();
