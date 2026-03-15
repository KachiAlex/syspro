#!/usr/bin/env node

/**
 * Final Comprehensive Functionality Test
 * Tests all modules with proper redirect handling and detailed reporting
 */

const http = require('http');

// Helper function to make HTTP requests with redirect handling
function makeRequest(options, data = null, followRedirects = true) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            
            // Handle redirects
            if (followRedirects && (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307)) {
                const location = res.headers.location;
                if (location) {
                    const redirectOptions = {
                        hostname: 'localhost',
                        port: 3000,
                        path: location,
                        method: options.method,
                        headers: options.headers
                    };
                    return makeRequest(redirectOptions, data, false).then(resolve).catch(reject);
                }
            }
            
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

// Test results tracker
const testResults = {
    passed: 0,
    failed: 0,
    total: 0,
    details: [],
    modules: {
        crm: { passed: 0, failed: 0, total: 0 },
        finance: { passed: 0, failed: 0, total: 0 },
        hr: { passed: 0, failed: 0, total: 0 },
        analytics: { passed: 0, failed: 0, total: 0 },
        projects: { passed: 0, failed: 0, total: 0 },
        security: { passed: 0, failed: 0, total: 0 },
        workflows: { passed: 0, failed: 0, total: 0 },
        ui: { passed: 0, failed: 0, total: 0 }
    }
};

// Test helper function
async function runTest(name, category, testFn) {
    testResults.total++;
    testResults.modules[category].total++;
    
    try {
        const result = await testFn();
        if (result.success) {
            testResults.passed++;
            testResults.modules[category].passed++;
            console.log(`✅ ${name}: PASSED`);
            testResults.details.push({ name, category, status: 'PASSED', details: result.details });
        } else {
            testResults.failed++;
            testResults.modules[category].failed++;
            console.log(`❌ ${name}: FAILED - ${result.error}`);
            testResults.details.push({ name, category, status: 'FAILED', error: result.error });
        }
    } catch (error) {
        testResults.failed++;
        testResults.modules[category].failed++;
        console.log(`❌ ${name}: ERROR - ${error.message}`);
        testResults.details.push({ name, category, status: 'ERROR', error: error.message });
    }
}

// CRM Module Tests
async function testCRMModule() {
    console.log('\n🔍 Testing CRM Module...');
    
    await runTest('CRM - Get Leads', 'crm', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/crm/leads?tenantSlug=kreatix-default',
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            return { success: true, details: `Found ${data.leads?.length || 0} leads` };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });

    await runTest('CRM - Create Lead', 'crm', async () => {
        const leadData = {
            tenantSlug: 'kreatix-default',
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

    await runTest('CRM - Get Contacts', 'crm', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/crm/contacts?tenantSlug=kreatix-default',
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
    
    await runTest('Finance - Get Invoices', 'finance', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/finance/invoices?tenantSlug=kreatix-default',
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            return { success: true, details: `Found ${data.invoices?.length || 0} invoices` };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });

    await runTest('Finance - Create Invoice (Correct Schema)', 'finance', async () => {
        const invoiceData = {
            tenantSlug: 'kreatix-default',
            customerName: 'Test Customer',
            invoiceNumber: 'INV-' + Date.now(),
            issuedDate: new Date().toISOString().split('T')[0],
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            currency: 'USD',
            amount: 1000,
            lineItems: [
                {
                    description: 'Test Service',
                    quantity: 1,
                    unitPrice: 1000,
                    amount: 1000
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

    await runTest('Finance - Get Payments', 'finance', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/finance/payments?tenantSlug=kreatix-default',
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
    
    await runTest('HR - Get Employees', 'hr', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/hr/employees?tenantSlug=kreatix-default',
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            return { success: true, details: `Found ${data.employees?.length || 0} employees` };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });

    await runTest('HR - Create Employee (Correct Schema)', 'hr', async () => {
        const employeeData = {
            tenantSlug: 'kreatix-default',
            name: 'John Doe',
            email: 'john.doe@example.com',
            department: 'Engineering',
            position: 'Software Engineer'
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
    
    await runTest('Analytics - Get Reports', 'analytics', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/tenant/analytics?tenantSlug=kreatix-default',
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
    
    await runTest('Projects - Get Projects', 'projects', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/projects?tenantSlug=kreatix-default',
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
    
    await runTest('Security - Get Users', 'security', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/tenant/users?tenantSlug=kreatix-default',
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
    
    await runTest('Workflows - Get Workflows', 'workflows', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/tenant/workflows?tenantSlug=kreatix-default',
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            return { success: true, details: `Found ${data.workflows?.length || 0} workflows` };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });
}

// UI Components Tests
async function testUIComponents() {
    console.log('\n🎨 Testing UI Components...');
    
    await runTest('UI - Dashboard Page Load', 'ui', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/tenant-admin',
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            return { success: true, details: `Dashboard page loaded successfully` };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });

    await runTest('UI - Form Validation', 'ui', async () => {
        const invalidData = { tenantSlug: 'kreatix-default' };
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/finance/invoices',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, invalidData);

        if (response.statusCode === 400) {
            const data = JSON.parse(response.body);
            const hasValidationErrors = data.error && (
                data.error.formErrors || data.error.fieldErrors
            );
            return { success: true, details: `Form validation working: ${hasValidationErrors}` };
        }
        return { success: false, error: `Expected validation error, got status ${response.statusCode}` };
    });
}

// Main test runner
async function runAllTests() {
    console.log('🧪 Starting Final Comprehensive ERP Functionality Tests...\n');
    
    await testCRMModule();
    await testFinanceModule();
    await testHRModule();
    await testAnalyticsModule();
    await testProjectsModule();
    await testSecurityModule();
    await testWorkflowsModule();
    await testUIComponents();
    
    // Print detailed summary
    console.log('\n📋 COMPREHENSIVE TEST SUMMARY');
    console.log('=============================');
    console.log(`Total Tests: ${testResults.total}`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
    
    console.log('\n📊 Module Breakdown:');
    Object.entries(testResults.modules).forEach(([module, results]) => {
        if (results.total > 0) {
            const rate = ((results.passed / results.total) * 100).toFixed(1);
            console.log(`  ${module.toUpperCase()}: ${results.passed}/${results.total} (${rate}%)`);
        }
    });
    
    if (testResults.failed > 0) {
        console.log('\n❌ Failed Tests:');
        testResults.details.filter(t => t.status === 'FAILED' || t.status === 'ERROR').forEach(test => {
            console.log(`  - ${test.name} (${test.category}): ${test.error}`);
        });
    }
    
    console.log('\n🎯 Functionality Assessment:');
    if (testResults.passed === testResults.total) {
        console.log('🎉 ALL TESTS PASSED - System is fully functional!');
    } else if (testResults.passed >= testResults.total * 0.8) {
        console.log('✅ System is mostly functional with minor issues');
    } else if (testResults.passed >= testResults.total * 0.5) {
        console.log('⚠️ System has significant issues that need attention');
    } else {
        console.log('🚨 System has major functionality problems');
    }
    
    console.log('\n🎉 Testing Complete!');
    process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests if this script is executed directly
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = { runAllTests, testResults };
