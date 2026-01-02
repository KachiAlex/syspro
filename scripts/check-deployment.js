#!/usr/bin/env node

/**
 * Quick Deployment Status Checker
 * Quickly checks if the deployment is responding
 */

const { testEndpoint } = require('./deployment-test');

const DEPLOYMENT_URLS = [
  'https://syspro-web-git-main-onyedikachi-akomas-projects.vercel.app',
  'https://syspro-e04jznkuj-onyedikachi-akomas-projects.vercel.app'
];

async function quickCheck() {
  console.log('🔍 Quick Deployment Status Check\n');
  
  for (const url of DEPLOYMENT_URLS) {
    console.log(`Testing: ${url}`);
    
    try {
      // Test the test page first as it's most likely to work
      const result = await testEndpoint(url, '/test', 200, 'Test page');
      
      if (result.success) {
        console.log('✅ Deployment is LIVE and responding!\n');
        console.log(`🔗 Test it yourself: ${url}/test`);
        console.log(`🔗 API Health: ${url}/api/health`);
        console.log(`🔗 Main App: ${url}/`);
        return true;
      }
    } catch (error) {
      console.log(`❌ ${url} - Not responding: ${error.message}`);
    }
  }
  
  console.log('\n❌ No deployments are responding yet.');
  console.log('The build might still be in progress or there may be an issue.');
  return false;
}

if (require.main === module) {
  quickCheck().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { quickCheck };