#!/usr/bin/env node

/**
 * Monitor Deployment Script
 * Continuously checks deployment status until Next.js routing is working
 */

const { testEndpoint } = require('./deployment-test.js');

const DEPLOYMENT_URL = 'https://syspro-web-git-main-onyedikachi-akomas-projects.vercel.app';
const CHECK_INTERVAL = 30000; // 30 seconds
const MAX_ATTEMPTS = 20; // 10 minutes total

async function monitorDeployment() {
  console.log('🔄 MONITORING DEPLOYMENT STATUS');
  console.log(`URL: ${DEPLOYMENT_URL}`);
  console.log(`Checking every ${CHECK_INTERVAL / 1000} seconds...\n`);
  
  let attempt = 0;
  
  while (attempt < MAX_ATTEMPTS) {
    attempt++;
    console.log(`📊 Attempt ${attempt}/${MAX_ATTEMPTS} - ${new Date().toLocaleTimeString()}`);
    
    try {
      // Test key endpoints
      const tests = [
        { endpoint: '/', name: 'Root' },
        { endpoint: '/test', name: 'Next.js Test Page' },
        { endpoint: '/api/health', name: 'API Health' }
      ];
      
      let allWorking = true;
      
      for (const test of tests) {
        const result = await testEndpoint(DEPLOYMENT_URL, test.endpoint, 200, test.name);
        
        if (result.success) {
          console.log(`   ✅ ${test.name}: Working`);
        } else {
          console.log(`   ❌ ${test.name}: ${result.error || 'Failed'}`);
          allWorking = false;
        }
      }
      
      if (allWorking) {
        console.log('\n🎉 SUCCESS! All endpoints are working!');
        console.log('Next.js routing has been fixed.');
        return true;
      }
      
      if (attempt < MAX_ATTEMPTS) {
        console.log(`\n⏳ Waiting ${CHECK_INTERVAL / 1000} seconds before next check...\n`);
        await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
      }
      
    } catch (error) {
      console.log(`   ❌ Error during check: ${error.message}`);
    }
  }
  
  console.log('\n⚠️  Maximum attempts reached. Deployment may need manual intervention.');
  return false;
}

// Run if called directly
if (require.main === module) {
  monitorDeployment().catch(error => {
    console.error('❌ Monitor script failed:', error);
    process.exit(1);
  });
}

module.exports = { monitorDeployment };