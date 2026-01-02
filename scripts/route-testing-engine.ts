#!/usr/bin/env node

/**
 * Route Testing Engine - Comprehensive testing of all application routes
 * Part of the Vercel Next.js Routing Fix implementation
 */

import axios, { AxiosResponse } from 'axios';
import { writeFileSync } from 'fs';
import { join } from 'path';

export interface RouteTestSuite {
  totalTests: number;
  passed: number;
  failed: number;
  results: RouteTestResult[];
  successRate: number;
  testDuration: number;
  timestamp: string;
}

export interface RouteTestResult {
  route: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  expectedStatus: number;
  actualStatus: number;
  responseTime: number;
  success: boolean;
  error?: string;
  contentValidation?: ContentValidation;
  headers?: Record<string, string>;
  bodySize?: number;
}

export interface ContentValidation {
  hasExpectedContent: boolean;
  contentType: string;
  bodySize: number;
  specificChecks: Record<string, boolean>;
}

export interface ApiTestResult {
  route: string;
  isValidJson: boolean;
  hasRequiredFields: boolean;
  responseStructure: any;
  validationErrors: string[];
}

export interface PageTestResult {
  route: string;
  hasValidHtml: boolean;
  hasExpectedElements: boolean;
  pageTitle?: string;
  metaTags: Record<string, string>;
  validationErrors: string[];
}

export class RouteTestingEngine {
  private baseUrl: string;
  private timeout: number;
  private retryAttempts: number;

  constructor(baseUrl: string, timeout: number = 10000, retryAttempts: number = 3) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = timeout;
    this.retryAttempts = retryAttempts;
  }

  /**
   * Test all application routes comprehensively
   */
  async testAllRoutes(): Promise<RouteTestSuite> {
    const startTime = Date.now();
    console.log(`🧪 Starting comprehensive route testing on: ${this.baseUrl}`);
    
    const testRoutes = [
      // Page routes
      { route: '/', method: 'GET' as const, expectedStatus: 200, type: 'page' },
      { route: '/test', method: 'GET' as const, expectedStatus: 200, type: 'page' },
      { route: '/login', method: 'GET' as const, expectedStatus: 200, type: 'page' },
      { route: '/dashboard', method: 'GET' as const, expectedStatus: 200, type: 'page' },
      
      // API routes
      { route: '/api/health', method: 'GET' as const, expectedStatus: 200, type: 'api' },
      { route: '/api/v1/health', method: 'GET' as const, expectedStatus: 200, type: 'api' },
      { route: '/api/v1/auth/login', method: 'POST' as const, expectedStatus: 400, type: 'api' }, // Expect 400 without body
      
      // Static assets (should work)
      { route: '/favicon.ico', method: 'GET' as const, expectedStatus: 200, type: 'static' },
      
      // 404 routes (should return 404)
      { route: '/nonexistent-page', method: 'GET' as const, expectedStatus: 404, type: 'page' },
      { route: '/api/nonexistent', method: 'GET' as const, expectedStatus: 404, type: 'api' }
    ];

    const results: RouteTestResult[] = [];
    
    for (const testRoute of testRoutes) {
      console.log(`\n🔍 Testing: ${testRoute.method} ${testRoute.route}`);
      const result = await this.testSingleRouteWithRetry(testRoute);
      results.push(result);
      
      const statusIcon = result.success ? '✅' : '❌';
      const statusText = result.success ? 'PASS' : 'FAIL';
      console.log(`   ${statusIcon} ${statusText} - ${result.actualStatus} (${result.responseTime}ms)`);
      
      if (result.error) {
        console.log(`   🔴 Error: ${result.error}`);
      }
      
      if (result.contentValidation && !result.contentValidation.hasExpectedContent) {
        console.log(`   ⚠️  Content validation failed`);
      }
    }

    const testDuration = Date.now() - startTime;
    const passed = results.filter(r => r.success).length;
    const failed = results.length - passed;
    const successRate = (passed / results.length) * 100;

    const suite: RouteTestSuite = {
      totalTests: results.length,
      passed,
      failed,
      results,
      successRate,
      testDuration,
      timestamp: new Date().toISOString()
    };

    console.log(`\n📊 Test Suite Summary:`);
    console.log(`   Total Tests: ${suite.totalTests}`);
    console.log(`   Passed: ${suite.passed} ✅`);
    console.log(`   Failed: ${suite.failed} ❌`);
    console.log(`   Success Rate: ${suite.successRate.toFixed(1)}%`);
    console.log(`   Duration: ${suite.testDuration}ms`);

    // Save detailed results
    await this.saveTestResults(suite);

    return suite;
  }

  /**
   * Validate API responses for structure and content
   */
  async validateApiResponses(routes: string[]): Promise<ApiTestResult[]> {
    console.log(`🔍 Validating API responses for ${routes.length} routes...`);
    
    const results: ApiTestResult[] = [];

    for (const route of routes) {
      console.log(`\n🧪 Validating API: ${route}`);
      
      try {
        const response = await axios.get(`${this.baseUrl}${route}`, {
          timeout: this.timeout,
          validateStatus: () => true
        });

        const result: ApiTestResult = {
          route,
          isValidJson: false,
          hasRequiredFields: false,
          responseStructure: null,
          validationErrors: []
        };

        // Check if response is valid JSON
        try {
          const data = typeof response.data === 'object' ? response.data : JSON.parse(response.data);
          result.isValidJson = true;
          result.responseStructure = data;
          
          // Validate required fields based on route
          result.hasRequiredFields = this.validateApiFields(route, data);
          
        } catch (jsonError) {
          result.validationErrors.push('Response is not valid JSON');
        }

        // Additional validations
        if (response.status >= 400) {
          result.validationErrors.push(`HTTP error status: ${response.status}`);
        }

        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('application/json') && result.isValidJson) {
          result.validationErrors.push('Content-Type header is not application/json');
        }

        results.push(result);
        
        const statusIcon = result.isValidJson && result.hasRequiredFields ? '✅' : '❌';
        console.log(`   ${statusIcon} JSON: ${result.isValidJson}, Fields: ${result.hasRequiredFields}`);
        
        if (result.validationErrors.length > 0) {
          result.validationErrors.forEach(error => {
            console.log(`   🔴 ${error}`);
          });
        }

      } catch (error) {
        const result: ApiTestResult = {
          route,
          isValidJson: false,
          hasRequiredFields: false,
          responseStructure: null,
          validationErrors: [error instanceof Error ? error.message : String(error)]
        };
        
        results.push(result);
        console.log(`   ❌ Request failed: ${result.validationErrors[0]}`);
      }
    }

    return results;
  }

  /**
   * Check page content for expected HTML elements
   */
  async checkPageContent(routes: string[]): Promise<PageTestResult[]> {
    console.log(`🔍 Checking page content for ${routes.length} routes...`);
    
    const results: PageTestResult[] = [];

    for (const route of routes) {
      console.log(`\n🧪 Checking page: ${route}`);
      
      try {
        const response = await axios.get(`${this.baseUrl}${route}`, {
          timeout: this.timeout,
          validateStatus: () => true
        });

        const result: PageTestResult = {
          route,
          hasValidHtml: false,
          hasExpectedElements: false,
          metaTags: {},
          validationErrors: []
        };

        const content = response.data;
        
        // Check if response is HTML
        if (typeof content === 'string') {
          result.hasValidHtml = content.includes('<html') || content.includes('<!DOCTYPE');
          
          // Extract page title
          const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) {
            result.pageTitle = titleMatch[1].trim();
          }
          
          // Extract meta tags
          const metaMatches = content.matchAll(/<meta\s+([^>]+)>/gi);
          for (const match of metaMatches) {
            const attrs = match[1];
            const nameMatch = attrs.match(/name=["']([^"']+)["']/i);
            const contentMatch = attrs.match(/content=["']([^"']+)["']/i);
            if (nameMatch && contentMatch) {
              result.metaTags[nameMatch[1]] = contentMatch[1];
            }
          }
          
          // Check for expected elements based on route
          result.hasExpectedElements = this.validatePageElements(route, content);
          
        } else {
          result.validationErrors.push('Response is not HTML content');
        }

        // Additional validations
        if (response.status >= 400) {
          result.validationErrors.push(`HTTP error status: ${response.status}`);
        }

        results.push(result);
        
        const statusIcon = result.hasValidHtml && result.hasExpectedElements ? '✅' : '❌';
        console.log(`   ${statusIcon} HTML: ${result.hasValidHtml}, Elements: ${result.hasExpectedElements}`);
        
        if (result.pageTitle) {
          console.log(`   📄 Title: "${result.pageTitle}"`);
        }
        
        if (result.validationErrors.length > 0) {
          result.validationErrors.forEach(error => {
            console.log(`   🔴 ${error}`);
          });
        }

      } catch (error) {
        const result: PageTestResult = {
          route,
          hasValidHtml: false,
          hasExpectedElements: false,
          metaTags: {},
          validationErrors: [error instanceof Error ? error.message : String(error)]
        };
        
        results.push(result);
        console.log(`   ❌ Request failed: ${result.validationErrors[0]}`);
      }
    }

    return results;
  }

  /**
   * Test a single route with retry logic
   */
  private async testSingleRouteWithRetry(testRoute: any): Promise<RouteTestResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await this.testSingleRoute(testRoute);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.retryAttempts) {
          console.log(`   🔄 Retry ${attempt}/${this.retryAttempts - 1} after error: ${lastError.message}`);
          await this.delay(1000 * attempt); // Exponential backoff
        }
      }
    }
    
    // All retries failed
    return {
      route: testRoute.route,
      method: testRoute.method,
      expectedStatus: testRoute.expectedStatus,
      actualStatus: 0,
      responseTime: 0,
      success: false,
      error: lastError?.message || 'Unknown error after retries'
    };
  }

  /**
   * Test a single route
   */
  private async testSingleRoute(testRoute: any): Promise<RouteTestResult> {
    const startTime = Date.now();
    
    const config: any = {
      method: testRoute.method,
      url: `${this.baseUrl}${testRoute.route}`,
      timeout: this.timeout,
      validateStatus: () => true // Don't throw on non-2xx status codes
    };

    // Add request body for POST requests
    if (testRoute.method === 'POST' && testRoute.route.includes('/auth/login')) {
      config.data = {}; // Empty body to test validation
      config.headers = { 'Content-Type': 'application/json' };
    }

    const response: AxiosResponse = await axios(config);
    const responseTime = Date.now() - startTime;
    
    // Determine success based on expected status
    const success = response.status === testRoute.expectedStatus;
    
    // Content validation
    const contentValidation = this.validateContent(testRoute, response);
    
    return {
      route: testRoute.route,
      method: testRoute.method,
      expectedStatus: testRoute.expectedStatus,
      actualStatus: response.status,
      responseTime,
      success: success && contentValidation.hasExpectedContent,
      contentValidation,
      headers: response.headers as Record<string, string>,
      bodySize: JSON.stringify(response.data).length
    };
  }

  /**
   * Validate response content based on route type
   */
  private validateContent(testRoute: any, response: AxiosResponse): ContentValidation {
    const data = response.data;
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    const contentType = response.headers['content-type'] || 'unknown';
    
    const validation: ContentValidation = {
      hasExpectedContent: true,
      contentType,
      bodySize: content.length,
      specificChecks: {}
    };

    // Route-specific validations
    switch (testRoute.route) {
      case '/':
        validation.specificChecks.hasAppContent = content.includes('Syspro') || content.includes('ERP') || content.includes('html');
        validation.hasExpectedContent = validation.specificChecks.hasAppContent;
        break;
        
      case '/test':
        validation.specificChecks.hasTestContent = content.toLowerCase().includes('test') || content.includes('success');
        validation.hasExpectedContent = validation.specificChecks.hasTestContent;
        break;
        
      case '/login':
        validation.specificChecks.hasLoginForm = content.toLowerCase().includes('login') || content.includes('form');
        validation.hasExpectedContent = validation.specificChecks.hasLoginForm;
        break;
        
      case '/api/health':
      case '/api/v1/health':
        validation.specificChecks.isJsonResponse = typeof data === 'object';
        validation.specificChecks.hasHealthData = !!(data && (data.status || data.health || data.ok));
        validation.hasExpectedContent = validation.specificChecks.isJsonResponse && validation.specificChecks.hasHealthData;
        break;
        
      default:
        // For other routes, just check that we got some content
        validation.specificChecks.hasContent = content.length > 0;
        validation.hasExpectedContent = validation.specificChecks.hasContent;
    }

    return validation;
  }

  /**
   * Validate API response fields
   */
  private validateApiFields(route: string, data: any): boolean {
    switch (route) {
      case '/api/health':
      case '/api/v1/health':
        return !!(data && (data.status || data.health || data.ok));
      default:
        return true; // No specific validation for other API routes
    }
  }

  /**
   * Validate page HTML elements
   */
  private validatePageElements(route: string, content: string): boolean {
    const lowerContent = content.toLowerCase();
    
    switch (route) {
      case '/':
        return lowerContent.includes('syspro') || lowerContent.includes('erp') || lowerContent.includes('<body');
      case '/test':
        return lowerContent.includes('test') || lowerContent.includes('success');
      case '/login':
        return lowerContent.includes('login') || lowerContent.includes('<form');
      default:
        return lowerContent.includes('<html') || lowerContent.includes('<!doctype');
    }
  }

  /**
   * Save test results to file
   */
  private async saveTestResults(suite: RouteTestSuite): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `route-test-results-${timestamp}.json`;
    const filepath = join(process.cwd(), 'test-results', filename);
    
    try {
      // Create test-results directory if it doesn't exist
      const { mkdirSync, existsSync } = require('fs');
      const testResultsDir = join(process.cwd(), 'test-results');
      if (!existsSync(testResultsDir)) {
        mkdirSync(testResultsDir, { recursive: true });
      }
      
      writeFileSync(filepath, JSON.stringify(suite, null, 2));
      console.log(`\n💾 Test results saved to: ${filepath}`);
      
      // Also create a summary report
      const summaryPath = join(process.cwd(), 'test-results', 'latest-summary.md');
      const summary = this.generateSummaryReport(suite);
      writeFileSync(summaryPath, summary);
      console.log(`📋 Summary report saved to: ${summaryPath}`);
      
    } catch (error) {
      console.error('❌ Failed to save test results:', error);
    }
  }

  /**
   * Generate a markdown summary report
   */
  private generateSummaryReport(suite: RouteTestSuite): string {
    const successIcon = suite.successRate === 100 ? '🎉' : suite.successRate >= 80 ? '✅' : '⚠️';
    
    let report = `# Route Testing Summary ${successIcon}\n\n`;
    report += `**Test Date**: ${new Date(suite.timestamp).toLocaleString()}\n`;
    report += `**Base URL**: ${this.baseUrl}\n`;
    report += `**Success Rate**: ${suite.successRate.toFixed(1)}% (${suite.passed}/${suite.totalTests})\n`;
    report += `**Duration**: ${suite.testDuration}ms\n\n`;
    
    report += `## Results Overview\n\n`;
    report += `| Route | Method | Status | Expected | Result | Time |\n`;
    report += `|-------|--------|--------|----------|--------|----- |\n`;
    
    for (const result of suite.results) {
      const icon = result.success ? '✅' : '❌';
      report += `| ${result.route} | ${result.method} | ${result.actualStatus} | ${result.expectedStatus} | ${icon} | ${result.responseTime}ms |\n`;
    }
    
    const failedTests = suite.results.filter(r => !r.success);
    if (failedTests.length > 0) {
      report += `\n## Failed Tests\n\n`;
      for (const test of failedTests) {
        report += `### ${test.method} ${test.route}\n`;
        report += `- **Expected**: ${test.expectedStatus}\n`;
        report += `- **Actual**: ${test.actualStatus}\n`;
        if (test.error) {
          report += `- **Error**: ${test.error}\n`;
        }
        report += `\n`;
      }
    }
    
    return report;
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI execution
if (require.main === module) {
  async function main() {
    const baseUrl = process.argv[2];
    
    if (!baseUrl) {
      console.error('❌ Please provide a base URL to test');
      console.log('Usage: npm run test-routes <base-url>');
      console.log('Example: npm run test-routes https://your-app.vercel.app');
      process.exit(1);
    }
    
    console.log('🚀 Starting Route Testing Engine...\n');
    
    const engine = new RouteTestingEngine(baseUrl);
    
    // Run comprehensive route testing
    const suite = await engine.testAllRoutes();
    
    // Additional API validation if any API routes passed
    const apiRoutes = suite.results
      .filter(r => r.route.startsWith('/api') && r.success)
      .map(r => r.route);
      
    if (apiRoutes.length > 0) {
      console.log('\n🔍 Running additional API validation...');
      await engine.validateApiResponses(apiRoutes);
    }
    
    // Additional page validation if any page routes passed
    const pageRoutes = suite.results
      .filter(r => !r.route.startsWith('/api') && !r.route.includes('.') && r.success)
      .map(r => r.route);
      
    if (pageRoutes.length > 0) {
      console.log('\n🔍 Running additional page content validation...');
      await engine.checkPageContent(pageRoutes);
    }
    
    // Final summary
    if (suite.successRate === 100) {
      console.log('\n🎉 All routes are working perfectly!');
    } else if (suite.successRate >= 80) {
      console.log('\n✅ Most routes are working. Check failed tests for issues.');
    } else {
      console.log('\n⚠️  Multiple route failures detected. Review configuration.');
    }
    
    process.exit(suite.successRate === 100 ? 0 : 1);
  }
  
  main().catch(error => {
    console.error('❌ Route testing failed:', error);
    process.exit(1);
  });
}

// Export is already done above with the class declaration