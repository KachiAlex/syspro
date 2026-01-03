#!/usr/bin/env node

/**
 * Vercel Production Deployment Script
 * Automates the deployment process to Vercel production
 * 
 * Usage: npx ts-node scripts/vercel-deploy.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface DeploymentConfig {
  projectName: string;
  buildCommand: string;
  installCommand: string;
  environmentVariables: Record<string, string>;
}

class VercelDeployer {
  private config: DeploymentConfig;
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.config = {
      projectName: 'syspro-erp',
      buildCommand: 'npm run vercel-build',
      installCommand: 'npm install',
      environmentVariables: {},
    };
  }

  /**
   * Check if Vercel CLI is installed
   */
  private checkVercelCLI(): boolean {
    try {
      execSync('vercel --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Install Vercel CLI if not present
   */
  private installVercelCLI(): void {
    console.log('📦 Installing Vercel CLI...');
    try {
      execSync('npm install -g vercel', { stdio: 'inherit' });
      console.log('✅ Vercel CLI installed');
    } catch (error) {
      console.error('❌ Failed to install Vercel CLI');
      throw error;
    }
  }

  /**
   * Verify git status
   */
  private verifyGitStatus(): void {
    console.log('🔍 Verifying git status...');
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf-8' });
      if (status.trim()) {
        console.warn('⚠️  Warning: You have uncommitted changes');
        console.warn('Please commit all changes before deploying');
        throw new Error('Uncommitted changes detected');
      }
      console.log('✅ Git status clean');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify environment variables
   */
  private verifyEnvironmentVariables(): void {
    console.log('🔍 Verifying environment variables...');
    
    const requiredVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'JWT_PASSWORD_RESET_SECRET',
      'JWT_EMAIL_VERIFICATION_SECRET',
      'NODE_ENV',
      'FRONTEND_URL',
      'CORS_ORIGINS',
    ];

    const missing: string[] = [];
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }

    if (missing.length > 0) {
      console.error('❌ Missing environment variables:');
      missing.forEach(v => console.error(`   - ${v}`));
      throw new Error('Missing required environment variables');
    }

    console.log('✅ All required environment variables present');
  }

  /**
   * Build the application
   */
  private buildApplication(): void {
    console.log('🔨 Building application...');
    try {
      execSync('npm run build', { stdio: 'inherit' });
      console.log('✅ Build successful');
    } catch (error) {
      console.error('❌ Build failed');
      throw error;
    }
  }

  /**
   * Deploy to Vercel
   */
  private deployToVercel(): void {
    console.log('🚀 Deploying to Vercel...');
    try {
      // Deploy to production
      execSync('vercel --prod', { stdio: 'inherit' });
      console.log('✅ Deployment successful');
    } catch (error) {
      console.error('❌ Deployment failed');
      throw error;
    }
  }

  /**
   * Verify deployment
   */
  private verifyDeployment(): void {
    console.log('🔍 Verifying deployment...');
    
    // Get deployment URL from Vercel
    try {
      const deploymentInfo = execSync('vercel ls --json', { encoding: 'utf-8' });
      const deployments = JSON.parse(deploymentInfo);
      
      if (deployments.length > 0) {
        const latestDeployment = deployments[0];
        console.log(`✅ Latest deployment: ${latestDeployment.url}`);
        
        // Test health endpoint
        console.log('🧪 Testing health endpoint...');
        const healthUrl = `https://${latestDeployment.url}/api/v1/health`;
        
        try {
          const response = execSync(`curl -s ${healthUrl}`, { encoding: 'utf-8' });
          const data = JSON.parse(response);
          
          if (data.status === 'ok') {
            console.log('✅ Health check passed');
          } else {
            console.warn('⚠️  Health check returned unexpected status');
          }
        } catch (error) {
          console.warn('⚠️  Could not verify health endpoint');
        }
      }
    } catch (error) {
      console.warn('⚠️  Could not verify deployment');
    }
  }

  /**
   * Run the deployment process
   */
  public async run(): Promise<void> {
    console.log('🚀 Syspro ERP - Vercel Production Deployment');
    console.log('='.repeat(50));
    console.log('');

    try {
      // Step 1: Check Vercel CLI
      console.log('📋 Step 1: Checking Vercel CLI...');
      if (!this.checkVercelCLI()) {
        this.installVercelCLI();
      } else {
        console.log('✅ Vercel CLI is installed');
      }
      console.log('');

      // Step 2: Verify git status
      console.log('📋 Step 2: Verifying git status...');
      this.verifyGitStatus();
      console.log('');

      // Step 3: Verify environment variables
      console.log('📋 Step 3: Verifying environment variables...');
      this.verifyEnvironmentVariables();
      console.log('');

      // Step 4: Build application
      console.log('📋 Step 4: Building application...');
      this.buildApplication();
      console.log('');

      // Step 5: Deploy to Vercel
      console.log('📋 Step 5: Deploying to Vercel...');
      this.deployToVercel();
      console.log('');

      // Step 6: Verify deployment
      console.log('📋 Step 6: Verifying deployment...');
      this.verifyDeployment();
      console.log('');

      console.log('='.repeat(50));
      console.log('✅ Deployment completed successfully!');
      console.log('');
      console.log('📝 Next steps:');
      console.log('  1. Change default admin password');
      console.log('  2. Set up error tracking (Sentry)');
      console.log('  3. Configure monitoring (UptimeRobot)');
      console.log('  4. Review deployment logs');
      console.log('');
      console.log('📚 Documentation:');
      console.log('  - DEPLOYMENT_EXECUTION_GUIDE.md');
      console.log('  - ACTION_PLAN.md');
      console.log('  - FINAL_DEPLOYMENT_CHECKLIST.md');
      console.log('');
    } catch (error) {
      console.error('');
      console.error('❌ Deployment failed');
      console.error('');
      
      if (error instanceof Error) {
        console.error('Error:', error.message);
      }
      
      console.error('');
      console.error('📝 Troubleshooting:');
      console.error('  1. Check DEPLOYMENT_EXECUTION_GUIDE.md');
      console.error('  2. Verify environment variables');
      console.error('  3. Check Vercel CLI is installed');
      console.error('  4. Review error messages above');
      console.error('');
      
      process.exit(1);
    }
  }
}

// Run the deployer
const deployer = new VercelDeployer();
deployer.run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
