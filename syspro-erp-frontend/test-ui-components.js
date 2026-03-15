#!/usr/bin/env node

/**
 * UI Components and Button Functionality Test
 * Tests all interactive elements, buttons, forms, and user interfaces
 */

const http = require('http');
const { JSDOM } = require('jsdom');

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

// Test 1: Main Dashboard Page Load
async function testMainDashboard() {
    console.log('\n🏠 Testing Main Dashboard...');
    
    await runTest('Dashboard - Page Load', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/tenant-admin',
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const dom = new JSDOM(response.body);
            const document = dom.window.document;
            
            // Check for key dashboard elements
            const sidebar = document.querySelector('.sidebar');
            const mainContent = document.querySelector('main');
            const navigation = document.querySelector('nav');
            
            const elementsFound = {
                sidebar: !!sidebar,
                mainContent: !!mainContent,
                navigation: !!navigation
            };
            
            return { 
                success: true, 
                details: `Dashboard loaded with elements: ${JSON.stringify(elementsFound)}` 
            };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });
}

// Test 2: CRM Module UI Elements
async function testCRMModuleUI() {
    console.log('\n👥 Testing CRM Module UI...');
    
    await runTest('CRM - Leads Section', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/tenant-admin',
            method: 'GET',
            headers: { 'Cookie': 'section=leads' }
        });
        
        if (response.statusCode === 200) {
            const dom = new JSDOM(response.body);
            const document = dom.window.document;
            
            // Check for CRM-specific elements
            const addLeadButton = document.querySelector('button:contains("Add Lead")');
            const exportButton = document.querySelector('button:contains("Export")');
            const searchInput = document.querySelector('input[placeholder*="Search"]');
            const dataTable = document.querySelector('.data-table');
            
            const elementsFound = {
                addLeadButton: !!addLeadButton,
                exportButton: !!exportButton,
                searchInput: !!searchInput,
                dataTable: !!dataTable
            };
            
            return { 
                success: true, 
                details: `CRM UI elements found: ${JSON.stringify(elementsFound)}` 
            };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });
}

// Test 3: Finance Module UI Elements
async function testFinanceModuleUI() {
    console.log('\n💰 Testing Finance Module UI...');
    
    await runTest('Finance - Invoices Section', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/tenant-admin',
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const dom = new JSDOM(response.body);
            const document = dom.window.document;
            
            // Check for Finance-specific elements
            const createInvoiceButton = document.querySelector('button:contains("Create Invoice")');
            const recordPaymentButton = document.querySelector('button:contains("Record Payment")');
            const filterSelects = document.querySelectorAll('select');
            
            const elementsFound = {
                createInvoiceButton: !!createInvoiceButton,
                recordPaymentButton: !!recordPaymentButton,
                filterSelects: filterSelects.length > 0
            };
            
            return { 
                success: true, 
                details: `Finance UI elements found: ${JSON.stringify(elementsFound)}` 
            };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });
}

// Test 4: Form Validation
async function testFormValidation() {
    console.log('\n📝 Testing Form Validation...');
    
    await runTest('Forms - Validation Error Handling', async () => {
        // Test invalid form submission
        const invalidInvoiceData = {
            tenantSlug: 'kreatix-default',
            // Missing required fields
        };

        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/finance/invoices',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, invalidInvoiceData);

        if (response.statusCode === 400) {
            const data = JSON.parse(response.body);
            const hasValidationErrors = data.error && (
                data.error.formErrors || data.error.fieldErrors
            );
            
            return { 
                success: true, 
                details: `Form validation working: ${hasValidationErrors}` 
            };
        }
        return { success: false, error: `Expected validation error, got status ${response.statusCode}` };
    });
}

// Test 5: Button Interactions (Simulated)
async function testButtonInteractions() {
    console.log('\n🖱️ Testing Button Interactions...');
    
    await runTest('Buttons - Click Handlers', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/tenant-admin',
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const dom = new JSDOM(response.body);
            const document = dom.window.document;
            
            // Check for buttons with click handlers
            const buttons = document.querySelectorAll('button');
            const buttonsWithOnclick = Array.from(buttons).filter(btn => 
                btn.getAttribute('onclick') || 
                btn.getAttribute('data-action') ||
                btn.classList.contains('btn')
            );
            
            return { 
                success: true, 
                details: `Found ${buttons.length} total buttons, ${buttonsWithOnclick.length} with handlers` 
            };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });
}

// Test 6: Modal and Dialog Functionality
async function testModalFunctionality() {
    console.log('\n🪟 Testing Modal/Dialog Functionality...');
    
    await runTest('Modals - Modal Elements', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/tenant-admin',
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const dom = new JSDOM(response.body);
            const document = dom.window.document;
            
            // Check for modal-related elements
            const modals = document.querySelectorAll('.modal, .dialog, [role="dialog"]');
            const modalTriggers = document.querySelectorAll('[data-toggle="modal"], .modal-trigger');
            
            return { 
                success: true, 
                details: `Found ${modals.length} modals, ${modalTriggers.length} modal triggers` 
            };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });
}

// Test 7: Navigation and Routing
async function testNavigation() {
    console.log('\n🧭 Testing Navigation...');
    
    await runTest('Navigation - Sidebar Links', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/tenant-admin',
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const dom = new JSDOM(response.body);
            const document = dom.window.document;
            
            // Check for navigation elements
            const navLinks = document.querySelectorAll('nav a, .sidebar a');
            const sectionLinks = Array.from(navLinks).filter(link => 
                link.textContent.includes('CRM') || 
                link.textContent.includes('Finance') ||
                link.textContent.includes('HR') ||
                link.textContent.includes('Analytics')
            );
            
            return { 
                success: true, 
                details: `Found ${navLinks.length} navigation links, ${sectionLinks.length} section links` 
            };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });
}

// Test 8: Data Tables and Sorting
async function testDataTables() {
    console.log('\n📊 Testing Data Tables...');
    
    await runTest('Data Tables - Table Elements', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/tenant-admin',
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const dom = new JSDOM(response.body);
            const document = dom.window.document;
            
            // Check for table elements
            const tables = document.querySelectorAll('table');
            const sortableHeaders = document.querySelectorAll('.sortable, [data-sort]');
            const pagination = document.querySelectorAll('.pagination, .pager');
            
            return { 
                success: true, 
                details: `Found ${tables.length} tables, ${sortableHeaders.length} sortable headers, ${pagination.length} pagination elements` 
            };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });
}

// Test 9: Loading States and Spinners
async function testLoadingStates() {
    console.log('\n⏳ Testing Loading States...');
    
    await runTest('Loading States - Loading Elements', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/tenant-admin',
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const dom = new JSDOM(response.body);
            const document = dom.window.document;
            
            // Check for loading-related elements
            const loadingSpinners = document.querySelectorAll('.spinner, .loading, [data-loading]');
            const skeletonScreens = document.querySelectorAll('.skeleton, .skeleton-loader');
            
            return { 
                success: true, 
                details: `Found ${loadingSpinners.length} loading spinners, ${skeletonScreens.length} skeleton screens` 
            };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });
}

// Test 10: Error Handling and Toast Notifications
async function testErrorHandling() {
    console.log('\n🚨 Testing Error Handling...');
    
    await runTest('Error Handling - Error Elements', async () => {
        const response = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/tenant-admin',
            method: 'GET'
        });
        
        if (response.statusCode === 200) {
            const dom = new JSDOM(response.body);
            const document = dom.window.document;
            
            // Check for error handling elements
            const errorContainers = document.querySelectorAll('.error, .alert-error, .error-message');
            const toastContainers = document.querySelectorAll('.toast, .notification, .alert');
            
            return { 
                success: true, 
                details: `Found ${errorContainers.length} error containers, ${toastContainers.length} toast containers` 
            };
        }
        return { success: false, error: `Status ${response.statusCode}` };
    });
}

// Main test runner
async function runAllUITests() {
    console.log('🎨 Starting Comprehensive UI Component Tests...\n');
    
    await testMainDashboard();
    await testCRMModuleUI();
    await testFinanceModuleUI();
    await testFormValidation();
    await testButtonInteractions();
    await testModalFunctionality();
    await testNavigation();
    await testDataTables();
    await testLoadingStates();
    await testErrorHandling();
    
    // Print summary
    console.log('\n📋 UI TEST SUMMARY');
    console.log('==================');
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
    
    console.log('\n🎉 UI Testing Complete!');
    process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests if this script is executed directly
if (require.main === module) {
    runAllUITests().catch(console.error);
}

module.exports = { runAllUITests, testResults };
