#!/usr/bin/env node

/**
 * Comprehensive Functionality Test Script
 * Tests all ERP modules and their API endpoints
 */

const http = require('http');

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    statusMessage: res.statusMessage,
                    headers: res.headers,
                    body: body
                });
            });
        });

        req.on('error', reject);
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TENANT_SLUG = 'kreatix-default';

// Test results tracker
const testResults = {
    passed: 0,
    failed: 0,
    total: 0,
    details: []
};

// Test helper function
async function runTest(name, testFn) {
    testResults.total++;
    try {
        const result = await testFn();
        if (result.success) {
            testResults.passed++;
            console.log(`✅ ${name}: PASSED`);
            testResults.details.push({ name, status: 'PASSED', details: result.details });
        } else {
            testResults.failed++;
            console.log(`❌ ${name}: FAILED - ${result.error}`);
            testResults.details.push({ name, status: 'FAILED', error: result.error });
        }
    } catch (error) {
        testResults.failed++;
        console.log(`❌ ${name}: ERROR - ${error.message}`);
        testResults.details.push({ name, status: 'ERROR', error: error.message });
    }
}

// CRM Module Tests
async function testCRMModule() {
    console.log('\n🔍 Testing CRM Module...');
    
    // Test 1: Get leads
    await runTest('CRM - Get Leads', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: `/api/crm/leads?tenantSlug=${TENANT_SLUG}`,
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            return { success: true, details: `Found ${data.leads?.length || 0} leads` };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });

    // Test 2: Create lead
    await runTest('CRM - Create Lead', async () => {
        const leadData = {
            tenantSlug: TENANT_SLUG,
            regionId: 'region-1',
            branchId: 'branch-1',
            companyName: 'Test Company ' + Date.now(),
            contactName: 'Test Contact',
            contactEmail: 'test@example.com',
            stage: 'new',
            source: 'website'
        };

        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/crm/leads',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, leadData);

        if (response.statusCode === 200 || response.statusCode === 201) {
            const data = JSON.parse(response.body);
            return { success: true, details: `Created lead with ID: ${data.lead?.id}` };
        }
        return { success: false, error: `Status ${response.statusCode}: ${response.body}` };
    });

    // Test 3: Get contacts
    await runTest('CRM - Get Contacts', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: `/api/crm/contacts?tenantSlug=${TENANT_SLUG}`,
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            return { success: true, details: `Found ${data.contacts?.length || 0} contacts` };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });
}

// Finance Module Tests
async function testFinanceModule() {
    console.log('\n💰 Testing Finance Module...');
    
    // Test 1: Get invoices
    await runTest('Finance - Get Invoices', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: `/api/finance/invoices?tenantSlug=${TENANT_SLUG}`,
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            return { success: true, details: `Found ${data.invoices?.length || 0} invoices` };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });

    // Test 2: Create invoice
    await runTest('Finance - Create Invoice', async () => {
        const invoiceData = {
            tenantSlug: TENANT_SLUG,
            clientId: 'client-1',
            invoiceNumber: 'INV-' + Date.now(),
            issueDate: new Date().toISOString().split('T')[0],
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'draft',
            subtotal: 1000,
            taxAmount: 100,
            totalAmount: 1100,
            currency: 'USD',
            lineItems: [
                {
                    description: 'Test Service',
                    quantity: 1,
                    unitPrice: 1000,
                    total: 1000
                }
            ]
        };

        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/finance/invoices',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, invoiceData);

        if (response.statusCode === 200 || response.statusCode === 201) {
            const data = JSON.parse(response.body);
            return { success: true, details: `Created invoice with ID: ${data.invoice?.id}` };
        }
        return { success: false, error: `Status ${response.statusCode}: ${response.body}` };
    });

    // Test 3: Get payments
    await runTest('Finance - Get Payments', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: `/api/finance/payments?tenantSlug=${TENANT_SLUG}`,
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            return { success: true, details: `Found ${data.payments?.length || 0} payments` };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });
}

// HR Module Tests
async function testHRModule() {
    console.log('\n👥 Testing HR Module...');
    
    // Test 1: Get employees
    await runTest('HR - Get Employees', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: `/api/hr/employees?tenantSlug=${TENANT_SLUG}`,
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            return { success: true, details: `Found ${data.employees?.length || 0} employees` };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });

    // Test 2: Create employee
    await runTest('HR - Create Employee', async () => {
        const employeeData = {
            tenantSlug: TENANT_SLUG,
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '+1-555-0123',
            department: 'Engineering',
            position: 'Software Engineer',
            startDate: new Date().toISOString().split('T')[0],
            status: 'active'
        };

        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/hr/employees',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, employeeData);

        if (response.statusCode === 200 || response.statusCode === 201) {
            const data = JSON.parse(response.body);
            return { success: true, details: `Created employee with ID: ${data.employee?.id}` };
        }
        return { success: false, error: `Status ${response.statusCode}: ${response.body}` };
    });
}

// Analytics Module Tests
async function testAnalyticsModule() {
    console.log('\n📊 Testing Analytics Module...');
    
    await runTest('Analytics - Get Reports', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: `/api/tenant/analytics?tenantSlug=${TENANT_SLUG}`,
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            return { success: true, details: `Found ${data.reports?.length || 0} reports, ${data.exports?.length || 0} exports` };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });
}

// Projects Module Tests
async function testProjectsModule() {
    console.log('\n🚀 Testing Projects Module...');
    
    await runTest('Projects - Get Projects', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: `/api/projects?tenantSlug=${TENANT_SLUG}`,
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            return { success: true, details: `Found ${data.projects?.length || 0} projects` };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });
}

// Security Module Tests
async function testSecurityModule() {
    console.log('\n🔒 Testing Security Module...');
    
    await runTest('Security - Get Users', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: `/api/tenant/users?tenantSlug=${TENANT_SLUG}`,
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            return { success: true, details: `Found ${data.users?.length || 0} users` };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });
}

// Workflows Module Tests
async function testWorkflowsModule() {
    console.log('\n⚙️ Testing Workflows Module...');
    
    await runTest('Workflows - Get Workflows', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: `/api/tenant/workflows?tenantSlug=${TENANT_SLUG}`,
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            return { success: true, details: `Found ${data.workflows?.length || 0} workflows` };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });
}

// Main test runner
async function runAllTests() {
    console.log('🧪 Starting Comprehensive ERP Functionality Tests...\n');
    
    await testCRMModule();
    await testFinanceModule();
    await testHRModule();
    await testAnalyticsModule();
    await testProjectsModule();
    await testSecurityModule();
    await testWorkflowsModule();
    
    // Print summary
    console.log('\n📋 TEST SUMMARY');
    console.log('================');
    console.log(`Total Tests: ${testResults.total}`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
    
    if (testResults.failed > 0) {
        console.log('\n❌ Failed Tests:');
        testResults.details.filter(t => t.status === 'FAILED' || t.status === 'ERROR').forEach(test => {
            console.log(`  - ${test.name}: ${test.error}`);
        });
    }
    
    console.log('\n🎉 Testing Complete!');
    process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests if this script is executed directly
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = { runAllTests, testResults };
