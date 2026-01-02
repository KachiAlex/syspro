#!/usr/bin/env node

/**
 * Deployment Testing Script
 * Tests the deployed Vercel application to ensure all components are working
 */

const https = require('https');
const http = require('http');

// Configuration
const DEPLOYMENT_URLS = [
  'https://syspro-web-git-main-onyedikachi-akomas-projects.vercel.app',
  'https://syspro-e04jznkuj-onyedikachi-akomas-projects.vercel.app'
];

const TIMEOUT = 10000; // 10 seconds

/**
 * Make HTTP request with timeout
 */
function makeRequest(url, timeout = TIMEOUT) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          url: url
        });
      });
    });
    
    req.on('error', (err) => {
      reject(new Error(`Request failed for ${url}: ${err.message}`));
    });
    
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error(`Request timeout for ${url} after ${timeout}ms`));
    });
  });
}

/**
 * Test a specific endpoint
 */
async function testEndpoint(baseUrl, endpoint, expectedStatus = 200, description = '') {
  const url = `${baseUrl}${endpoint}`;
  
  try {
    console.log(`🔍 Testing: ${description || endpoint}`);
    console.log(`   URL: ${url}`);
    
    const response = await makeRequest(url);
    
    if (response.statusCode === expectedStatus) {
      console.log(`   ✅ SUCCESS: Status ${response.statusCode}`);
      
      // Additional checks based on endpoint
      if (endpoint.includes('/api/health')) {
        try {
          const json = JSON.parse(response.body);
          if (json.success) {
            console.log(`   ✅ API Health: ${json.message}`);
          } else {
            console.log(`   ⚠️  API Health: ${json.message || 'Unknown status'}`);
          }
        } catch (e) {
          console.log(`   ⚠️  API Health: Invalid JSON response`);
        }
      }
      
      if (endpoint === '/test') {
        if (response.body.includes('Deployment Successful')) {
          console.log(`   ✅ Test Page: Contains success message`);
        } else {
          console.log(`   ⚠️  Test Page: Missing success message`);
        }
      }
      
      return { success: true, status: response.statusCode, url };
    } else {
      console.log(`   ❌ FAILED: Expected ${expectedStatus}, got ${response.statusCode}`);
      return { success: false, status: response.statusCode, url, error: `Wrong status code` };
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    return { success: false, url, error: error.message };
  }
}

/**
 * Test all endpoints for a deployment URL
 */
async function testDeployment(baseUrl) {
  console.log(`\n🚀 Testing deployment: ${baseUrl}`);
  console.log('=' .repeat(80));
  
  const tests = [
    { endpoint: '/index.html', description: 'Static HTML fallback' },
    { endpoint: '/test', description: 'Next.js test page' },
    { endpoint: '/api/health', description: 'API health endpoint' },
    { endpoint: '/', description: 'Main application' },
  ];
  
  const results = [];
  
  for (const test of tests) {
    const result = await testEndpoint(baseUrl, test.endpoint, 200, test.description);
    results.push(result);
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}

/**
 * Generate test report
 */
function generateReport(allResults) {
  console.log('\n📊 DEPLOYMENT TEST REPORT');
  console.log('=' .repeat(80));
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  
  for (const [baseUrl, results] of Object.entries(allResults)) {
    console.log(`\n🌐 ${baseUrl}`);
    
    for (const result of results) {
      totalTests++;
      if (result.success) {
        passedTests++;
        console.log(`   ✅ ${result.url.replace(baseUrl, '')} - Status ${result.status}`);
      } else {
        failedTests++;
        console.log(`   ❌ ${result.url.replace(baseUrl, '')} - ${result.error}`);
      }
    }
  }
  
  console.log(`\n📈 SUMMARY`);
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${passedTests} ✅`);
  console.log(`   Failed: ${failedTests} ❌`);
  console.log(`   Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (failedTests === 0) {
    console.log(`\n🎉 ALL TESTS PASSED! Deployment is successful.`);
    return true;
  } else {
    console.log(`\n⚠️  Some tests failed. Check the deployment.`);
    return false;
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('🧪 SYSPRO ERP DEPLOYMENT TESTING');
  console.log('Testing deployed application endpoints...\n');
  
  const allResults = {};
  
  for (const url of DEPLOYMENT_URLS) {
    try {
      const results = await testDeployment(url);
      allResults[url] = results;
    } catch (error) {
      console.log(`❌ Failed to test ${url}: ${error.message}`);
      allResults[url] = [{ success: false, url, error: error.message }];
    }
  }
  
  const success = generateReport(allResults);
  
  console.log('\n🔗 Quick Test Links:');
  for (const url of DEPLOYMENT_URLS) {
    console.log(`   ${url}/test`);
    console.log(`   ${url}/api/health`);
  }
  
  process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });
}

module.exports = { testDeployment, testEndpoint, makeRequest };