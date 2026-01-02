#!/usr/bin/env node

/**
 * Deployment Status Check - Quick status overview and next steps
 * Part of the Vercel Next.js Routing Fix implementation
 */

import axios from 'axios';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface DeploymentStatus {
  isLive: boolean;
  baseUrl: string;
  workingRoutes: string[];
  failingRoutes: string[];
  successRate: number;
  nextSteps: string[];
  frameworkDetected: boolean;
}

class DeploymentStatusChecker {
  private deploymentUrl: string;

  constructor() {
    // Try to detect deployment URL from various sources
    this.deploymentUrl = this.detectDeploymentUrl();
  }

  /**
   * Check comprehensive deployment status
   */
  async checkStatus(): Promise<DeploymentStatus> {
    console.log('🔍 Checking deployment status...\n');
    
    const status: DeploymentStatus = {
      isLive: false,
      baseUrl: this.deploymentUrl,
      workingRoutes: [],
      failingRoutes: [],
      successRate: 0,
      nextSteps: [],
      frameworkDetected: false
    };

    if (!this.deploymentUrl) {
      status.nextSteps.push('❌ No deployment URL found. Deploy to Vercel first.');
      return status;
    }

    console.log(`🌐 Testing deployment: ${this.deploymentUrl}`);

    // Test critical routes
    const testRoutes = [
      { route: '/', name: 'Root Page' },
      { route: '/test', name: 'Test Page' },
      { route: '/login', name: 'Login Page' },
      { route: '/api/health', name: 'Health API' },
      { route: '/api/v1/health', name: 'Health API v1' }
    ];

    for (const testRoute of testRoutes) {
      try {
        const response = await axios.get(`${this.deploymentUrl}${testRoute.route}`, {
          timeout: 10000,
          validateStatus: () => true
        });

        if (response.status === 200) {
          status.workingRoutes.push(`✅ ${testRoute.name} (${testRoute.route})`);
          if (testRoute.route === '/') {
            status.isLive = true;
          }
        } else {
          status.failingRoutes.push(`❌ ${testRoute.name} (${testRoute.route}) - ${response.status}`);
        }
      } catch (error) {
        status.failingRoutes.push(`❌ ${testRoute.name} (${testRoute.route}) - Error`);
      }
    }

    // Calculate success rate
    const totalRoutes = status.workingRoutes.length + status.failingRoutes.length;
    status.successRate = totalRoutes > 0 ? (status.workingRoutes.length / totalRoutes) * 100 : 0;

    // Determine framework detection status
    status.frameworkDetected = this.checkFrameworkDetection();

    // Generate next steps
    status.nextSteps = this.generateNextSteps(status);

    return status;
  }

  /**
   * Display comprehensive status report
   */
  displayStatus(status: DeploymentStatus): void {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 SYSPRO ERP DEPLOYMENT STATUS REPORT');
    console.log('='.repeat(60));
    
    // Overall status
    const overallIcon = status.isLive ? '🟢' : '🔴';
    const overallStatus = status.isLive ? 'LIVE' : 'OFFLINE';
    console.log(`\n${overallIcon} **DEPLOYMENT STATUS**: ${overallStatus}`);
    console.log(`🌐 **URL**: ${status.baseUrl}`);
    console.log(`📊 **SUCCESS RATE**: ${status.successRate.toFixed(1)}%`);
    
    // Framework detection
    const frameworkIcon = status.frameworkDetected ? '✅' : '❌';
    const frameworkStatus = status.frameworkDetected ? 'DETECTED' : 'NOT DETECTED';
    console.log(`🔧 **NEXT.JS FRAMEWORK**: ${frameworkIcon} ${frameworkStatus}`);
    
    // Working routes
    if (status.workingRoutes.length > 0) {
      console.log(`\n✅ **WORKING ROUTES** (${status.workingRoutes.length}):`);
      status.workingRoutes.forEach(route => console.log(`   ${route}`));
    }
    
    // Failing routes
    if (status.failingRoutes.length > 0) {
      console.log(`\n❌ **FAILING ROUTES** (${status.failingRoutes.length}):`);
      status.failingRoutes.forEach(route => console.log(`   ${route}`));
    }
    
    // Next steps
    console.log(`\n🎯 **NEXT STEPS**:`);
    status.nextSteps.forEach((step, index) => {
      console.log(`   ${index + 1}. ${step}`);
    });
    
    console.log('\n' + '='.repeat(60));
    
    // Quick action commands
    if (status.failingRoutes.length > 0) {
      console.log('\n🚀 **QUICK ACTIONS**:');
      console.log('   Strategy 1 (Recommended): npm run deploy:strategy1');
      console.log('   Strategy 2 (Config File):  npm run deploy:strategy2');
      console.log('   Test Routes:               npm run test:routes ' + status.baseUrl);
      console.log('   Full Guide:                cat NEXT_JS_ROUTING_FIX_GUIDE.md');
    }
    
    console.log('\n');
  }

  /**
   * Detect deployment URL from various sources
   */
  private detectDeploymentUrl(): string {
    // Try environment variables first
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    
    // Try deployment status file
    const statusFile = join(process.cwd(), 'DEPLOYMENT_STATUS.md');
    if (existsSync(statusFile)) {
      const content = readFileSync(statusFile, 'utf8');
      const urlMatch = content.match(/https:\/\/[^\s\)]+\.vercel\.app/);
      if (urlMatch) {
        return urlMatch[0];
      }
    }
    
    // Try common deployment files
    const deploymentFiles = [
      'FINAL_DEPLOYMENT_SUMMARY.md',
      'DEPLOYMENT_SUCCESS_SUMMARY.md',
      'DEPLOY_NOW.md'
    ];
    
    for (const file of deploymentFiles) {
      const filePath = join(process.cwd(), file);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf8');
        const urlMatch = content.match(/https:\/\/[^\s\)]+\.vercel\.app/);
        if (urlMatch) {
          return urlMatch[0];
        }
      }
    }
    
    // Default known URL (from context)
    return 'https://syspro-web-git-main-onyedikachi-akomas-projects.vercel.app';
  }

  /**
   * Check if Next.js framework is detected
   */
  private checkFrameworkDetection(): boolean {
    // Check vercel.json for framework configuration
    const vercelJsonPath = join(process.cwd(), 'vercel.json');
    if (existsSync(vercelJsonPath)) {
      try {
        const config = JSON.parse(readFileSync(vercelJsonPath, 'utf8'));
        if (config.framework === 'nextjs') {
          return true;
        }
      } catch (error) {
        // Ignore JSON parse errors
      }
    }
    
    // If no explicit configuration, assume not detected (based on current issues)
    return false;
  }

  /**
   * Generate next steps based on current status
   */
  private generateNextSteps(status: DeploymentStatus): string[] {
    const steps: string[] = [];
    
    if (!status.isLive) {
      steps.push('🚨 Deploy application to Vercel first');
      steps.push('📋 Follow deployment guide in DEPLOYMENT.md');
      return steps;
    }
    
    if (status.successRate === 100) {
      steps.push('🎉 All routes working! Deployment is successful');
      steps.push('✅ Run comprehensive tests: npm run test:routes ' + status.baseUrl);
      steps.push('📝 Document successful configuration for future reference');
      return steps;
    }
    
    if (status.successRate >= 80) {
      steps.push('⚠️  Most routes working, minor issues to resolve');
      steps.push('🔍 Check specific failing routes for configuration issues');
      steps.push('🧪 Run detailed testing: npm run test:routes ' + status.baseUrl);
    } else if (status.successRate >= 40) {
      steps.push('🎯 CRITICAL: Next.js routing not working (monorepo issue)');
      steps.push('🥇 Try Strategy 1: npm run deploy:strategy1 (Dashboard config)');
      steps.push('📋 Follow instructions in VERCEL_DASHBOARD_CONFIG.md');
      steps.push('🔄 Redeploy after configuration change');
    } else {
      steps.push('🚨 CRITICAL: Major deployment issues detected');
      steps.push('🔍 Check build logs for errors');
      steps.push('🛠️  Verify local build works: npm run build:validate');
      steps.push('📞 Consider contacting Vercel support');
    }
    
    // Always add testing step
    steps.push('🧪 Test after changes: npm run test:routes ' + status.baseUrl);
    
    return steps;
  }
}

// CLI execution
if (require.main === module) {
  async function main() {
    const checker = new DeploymentStatusChecker();
    
    try {
      const status = await checker.checkStatus();
      checker.displayStatus(status);
      
      // Exit with appropriate code
      process.exit(status.successRate === 100 ? 0 : 1);
      
    } catch (error) {
      console.error('❌ Status check failed:', error);
      console.log('\n🔧 **TROUBLESHOOTING**:');
      console.log('   1. Check internet connection');
      console.log('   2. Verify deployment URL is correct');
      console.log('   3. Ensure deployment is not in progress');
      process.exit(1);
    }
  }
  
  main();
}

export { DeploymentStatusChecker };