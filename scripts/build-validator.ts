#!/usr/bin/env node

/**
 * Build Validator - Verifies Next.js application builds and runs correctly locally
 * Part of the Vercel Next.js Routing Fix implementation
 */

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import axios from 'axios';

export interface BuildResult {
  success: boolean;
  buildTime: number;
  errors: string[];
  warnings: string[];
  outputFiles: string[];
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
}

export interface ContentValidation {
  hasExpectedContent: boolean;
  contentType: string;
  bodySize: number;
  specificChecks: Record<string, boolean>;
}

export interface BuildOutputAnalysis {
  hasServerFunctions: boolean;
  hasStaticPages: boolean;
  hasApiRoutes: boolean;
  buildOutputPath: string;
  serverFunctionCount: number;
  staticPageCount: number;
}

export class BuildValidator {
  private webAppPath: string;
  private buildOutputPath: string;

  constructor() {
    this.webAppPath = join(process.cwd(), 'apps', 'web');
    this.buildOutputPath = join(this.webAppPath, '.next');
  }

  /**
   * Validates that the Next.js application builds successfully locally
   */
  async validateLocalBuild(): Promise<BuildResult> {
    const startTime = Date.now();
    const result: BuildResult = {
      success: false,
      buildTime: 0,
      errors: [],
      warnings: [],
      outputFiles: []
    };

    try {
      console.log('🔨 Starting local Next.js build validation...');
      
      // Check if web app directory exists
      if (!existsSync(this.webAppPath)) {
        result.errors.push(`Web app directory not found: ${this.webAppPath}`);
        return result;
      }

      // Check if package.json exists
      const packageJsonPath = join(this.webAppPath, 'package.json');
      if (!existsSync(packageJsonPath)) {
        result.errors.push(`package.json not found in web app: ${packageJsonPath}`);
        return result;
      }

      // Run the build command
      console.log('📦 Running npm run build...');
      const buildOutput = execSync('npm run build', {
        cwd: this.webAppPath,
        encoding: 'utf8',
        timeout: 300000 // 5 minutes timeout
      });

      // Parse build output for warnings and errors
      const lines = buildOutput.split('\n');
      for (const line of lines) {
        if (line.includes('warn') || line.includes('Warning')) {
          result.warnings.push(line.trim());
        }
        if (line.includes('error') || line.includes('Error') || line.includes('failed')) {
          result.errors.push(line.trim());
        }
      }

      // Check if build output directory exists
      if (!existsSync(this.buildOutputPath)) {
        result.errors.push(`Build output directory not found: ${this.buildOutputPath}`);
        return result;
      }

      // Get list of output files
      result.outputFiles = this.getOutputFiles(this.buildOutputPath);
      
      result.success = result.errors.length === 0;
      result.buildTime = Date.now() - startTime;

      console.log(`✅ Build validation completed in ${result.buildTime}ms`);
      console.log(`📁 Generated ${result.outputFiles.length} output files`);
      
      if (result.warnings.length > 0) {
        console.log(`⚠️  Found ${result.warnings.length} warnings`);
      }

      return result;

    } catch (error) {
      result.errors.push(`Build failed: ${error instanceof Error ? error.message : String(error)}`);
      result.buildTime = Date.now() - startTime;
      console.error('❌ Build validation failed:', error);
      return result;
    }
  }

  /**
   * Tests local routes by starting a development server
   */
  async testLocalRoutes(): Promise<RouteTestResult[]> {
    console.log('🧪 Starting local route testing...');
    
    const testRoutes = [
      { route: '/', method: 'GET' as const, expectedStatus: 200 },
      { route: '/test', method: 'GET' as const, expectedStatus: 200 },
      { route: '/login', method: 'GET' as const, expectedStatus: 200 },
      { route: '/api/health', method: 'GET' as const, expectedStatus: 200 }
    ];

    const results: RouteTestResult[] = [];
    let serverProcess: any = null;

    try {
      // Start the Next.js development server
      console.log('🚀 Starting Next.js development server...');
      serverProcess = spawn('npm', ['run', 'dev'], {
        cwd: this.webAppPath,
        stdio: 'pipe'
      });

      // Wait for server to start (check for "Ready" message)
      await this.waitForServer(serverProcess, 30000);
      
      // Test each route
      for (const testRoute of testRoutes) {
        const result = await this.testSingleRoute(testRoute);
        results.push(result);
      }

      console.log(`✅ Local route testing completed. ${results.filter(r => r.success).length}/${results.length} routes passed`);

    } catch (error) {
      console.error('❌ Local route testing failed:', error);
      // Add error result for all routes
      for (const testRoute of testRoutes) {
        results.push({
          ...testRoute,
          actualStatus: 0,
          responseTime: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } finally {
      // Clean up server process
      if (serverProcess) {
        serverProcess.kill();
      }
    }

    return results;
  }

  /**
   * Analyzes the build output for server functions and static pages
   */
  async checkBuildOutput(): Promise<BuildOutputAnalysis> {
    console.log('🔍 Analyzing build output...');
    
    const analysis: BuildOutputAnalysis = {
      hasServerFunctions: false,
      hasStaticPages: false,
      hasApiRoutes: false,
      buildOutputPath: this.buildOutputPath,
      serverFunctionCount: 0,
      staticPageCount: 0
    };

    try {
      if (!existsSync(this.buildOutputPath)) {
        console.log('⚠️  Build output directory not found. Run build first.');
        return analysis;
      }

      // Check for server functions
      const serverPath = join(this.buildOutputPath, 'server');
      if (existsSync(serverPath)) {
        analysis.hasServerFunctions = true;
        analysis.serverFunctionCount = this.countFiles(serverPath, '.js');
      }

      // Check for static pages
      const staticPath = join(this.buildOutputPath, 'static');
      if (existsSync(staticPath)) {
        analysis.hasStaticPages = true;
        analysis.staticPageCount = this.countFiles(staticPath, '.html');
      }

      // Check for API routes in server functions
      const serverAppPath = join(this.buildOutputPath, 'server', 'app');
      if (existsSync(serverAppPath)) {
        const apiPath = join(serverAppPath, 'api');
        analysis.hasApiRoutes = existsSync(apiPath);
      }

      console.log('📊 Build output analysis:');
      console.log(`   Server functions: ${analysis.hasServerFunctions ? '✅' : '❌'} (${analysis.serverFunctionCount} files)`);
      console.log(`   Static pages: ${analysis.hasStaticPages ? '✅' : '❌'} (${analysis.staticPageCount} files)`);
      console.log(`   API routes: ${analysis.hasApiRoutes ? '✅' : '❌'}`);

    } catch (error) {
      console.error('❌ Build output analysis failed:', error);
    }

    return analysis;
  }

  /**
   * Helper method to get all output files recursively
   */
  private getOutputFiles(dir: string, files: string[] = []): string[] {
    try {
      const items = readdirSync(dir);
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          this.getOutputFiles(fullPath, files);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore errors for inaccessible directories
    }
    return files;
  }

  /**
   * Helper method to count files with specific extension
   */
  private countFiles(dir: string, extension: string): number {
    try {
      const files = this.getOutputFiles(dir);
      return files.filter(file => file.endsWith(extension)).length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Wait for the development server to be ready
   */
  private async waitForServer(serverProcess: any, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, timeout);

      serverProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        if (output.includes('Ready') || output.includes('started server on')) {
          clearTimeout(timeoutId);
          resolve();
        }
      });

      serverProcess.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        if (output.includes('Error') || output.includes('failed')) {
          clearTimeout(timeoutId);
          reject(new Error(`Server startup failed: ${output}`));
        }
      });

      serverProcess.on('error', (error: Error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Test a single route
   */
  private async testSingleRoute(testRoute: { route: string; method: 'GET' | 'POST' | 'PUT' | 'DELETE'; expectedStatus: number }): Promise<RouteTestResult> {
    const startTime = Date.now();
    const baseUrl = 'http://localhost:3000';
    
    try {
      const response = await axios({
        method: testRoute.method,
        url: `${baseUrl}${testRoute.route}`,
        timeout: 10000,
        validateStatus: () => true // Don't throw on non-2xx status codes
      });

      const responseTime = Date.now() - startTime;
      const success = response.status === testRoute.expectedStatus;

      // Content validation
      const contentValidation: ContentValidation = {
        hasExpectedContent: this.validateRouteContent(testRoute.route, response.data),
        contentType: response.headers['content-type'] || 'unknown',
        bodySize: JSON.stringify(response.data).length,
        specificChecks: this.getSpecificChecks(testRoute.route, response.data)
      };

      return {
        route: testRoute.route,
        method: testRoute.method,
        expectedStatus: testRoute.expectedStatus,
        actualStatus: response.status,
        responseTime,
        success: success && contentValidation.hasExpectedContent,
        contentValidation
      };

    } catch (error) {
      return {
        route: testRoute.route,
        method: testRoute.method,
        expectedStatus: testRoute.expectedStatus,
        actualStatus: 0,
        responseTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate that route content contains expected elements
   */
  private validateRouteContent(route: string, data: any): boolean {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    
    switch (route) {
      case '/':
        return content.includes('Syspro') || content.includes('ERP');
      case '/test':
        return content.includes('test') || content.includes('Test');
      case '/login':
        return content.includes('login') || content.includes('Login') || content.includes('form');
      case '/api/health':
        return typeof data === 'object' && (data.status || data.health);
      default:
        return true; // No specific validation for other routes
    }
  }

  /**
   * Get specific content checks for each route
   */
  private getSpecificChecks(route: string, data: any): Record<string, boolean> {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    
    switch (route) {
      case '/api/health':
        return {
          isJson: typeof data === 'object',
          hasStatusField: !!(data && data.status),
          hasHealthField: !!(data && data.health)
        };
      case '/login':
        return {
          hasForm: content.includes('<form') || content.includes('form'),
          hasLoginText: content.toLowerCase().includes('login'),
          hasInputFields: content.includes('<input') || content.includes('input')
        };
      default:
        return {
          hasContent: content.length > 0,
          isHtml: content.includes('<html') || content.includes('<!DOCTYPE')
        };
    }
  }
}

// CLI execution
if (require.main === module) {
  async function main() {
    const validator = new BuildValidator();
    
    console.log('🚀 Starting comprehensive build validation...\n');
    
    // Step 1: Validate local build
    const buildResult = await validator.validateLocalBuild();
    console.log('\n📊 Build Result:', {
      success: buildResult.success,
      buildTime: `${buildResult.buildTime}ms`,
      errors: buildResult.errors.length,
      warnings: buildResult.warnings.length,
      outputFiles: buildResult.outputFiles.length
    });
    
    if (!buildResult.success) {
      console.error('\n❌ Build validation failed. Errors:');
      buildResult.errors.forEach(error => console.error(`   - ${error}`));
      process.exit(1);
    }
    
    // Step 2: Analyze build output
    const outputAnalysis = await validator.checkBuildOutput();
    console.log('\n📁 Build Output Analysis:', {
      serverFunctions: outputAnalysis.hasServerFunctions,
      staticPages: outputAnalysis.hasStaticPages,
      apiRoutes: outputAnalysis.hasApiRoutes,
      serverFunctionCount: outputAnalysis.serverFunctionCount,
      staticPageCount: outputAnalysis.staticPageCount
    });
    
    // Step 3: Test local routes (optional - can be slow)
    if (process.argv.includes('--test-routes')) {
      const routeResults = await validator.testLocalRoutes();
      console.log('\n🧪 Route Test Results:');
      routeResults.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`   ${status} ${result.method} ${result.route} - ${result.actualStatus} (${result.responseTime}ms)`);
        if (result.error) {
          console.log(`      Error: ${result.error}`);
        }
      });
    }
    
    console.log('\n✅ Build validation completed successfully!');
  }
  
  main().catch(error => {
    console.error('❌ Build validation failed:', error);
    process.exit(1);
  });
}