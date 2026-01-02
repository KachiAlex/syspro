#!/usr/bin/env node

/**
 * Vercel Configuration Manager - Implements multiple deployment strategies
 * Part of the Vercel Next.js Routing Fix implementation
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import axios from 'axios';

export interface ConfigResult {
  strategy: string;
  applied: boolean;
  deploymentUrl?: string;
  testResults: RouteTestResult[];
  error?: string;
}

export interface DeploymentResult {
  success: boolean;
  deploymentUrl?: string;
  buildLogs: string[];
  error?: string;
}

export interface ProjectResult {
  success: boolean;
  projectId?: string;
  deploymentUrl?: string;
  error?: string;
}

export interface RouteTestResult {
  route: string;
  status: number;
  success: boolean;
  responseTime: number;
  error?: string;
}

export class VercelConfigManager {
  private projectRoot: string;
  private webAppPath: string;
  private vercelJsonPath: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.webAppPath = join(this.projectRoot, 'apps', 'web');
    this.vercelJsonPath = join(this.projectRoot, 'vercel.json');
  }

  /**
   * Strategy 1: Apply Vercel Dashboard Configuration
   * This provides instructions for manual dashboard configuration
   */
  async applyDashboardConfig(): Promise<ConfigResult> {
    console.log('🎯 Strategy 1: Vercel Dashboard Configuration');
    
    const result: ConfigResult = {
      strategy: 'Dashboard Configuration',
      applied: false,
      testResults: []
    };

    try {
      // Generate dashboard configuration instructions
      const instructions = this.generateDashboardInstructions();
      
      // Save instructions to file for user reference
      const instructionsPath = join(this.projectRoot, 'VERCEL_DASHBOARD_CONFIG.md');
      writeFileSync(instructionsPath, instructions);
      
      console.log('📋 Dashboard configuration instructions generated:');
      console.log(`   File: ${instructionsPath}`);
      console.log('\n' + instructions);
      
      result.applied = true;
      
      // Note: This strategy requires manual action, so we can't test immediately
      console.log('\n⚠️  This strategy requires manual action in the Vercel dashboard.');
      console.log('   Please follow the instructions above, then run route tests manually.');
      
      return result;

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error('❌ Dashboard configuration failed:', result.error);
      return result;
    }
  }

  /**
   * Strategy 2: Generate Optimized Vercel.json Configuration
   */
  async generateOptimalVercelJson(): Promise<string> {
    console.log('🎯 Strategy 2: Optimized Vercel.json Configuration');
    
    try {
      const config = {
        "version": 2,
        "name": "syspro-erp-web",
        "framework": "nextjs",
        "buildCommand": "cd apps/web && npm run build",
        "outputDirectory": "apps/web/.next",
        "installCommand": "npm install",
        "rootDirectory": "apps/web",
        "builds": [
          {
            "src": "apps/web/package.json",
            "use": "@vercel/next"
          }
        ],
        "routes": [
          {
            "src": "/api/(.*)",
            "dest": "/api/$1"
          },
          {
            "src": "/(.*)",
            "dest": "/$1"
          }
        ],
        "functions": {
          "apps/web/src/app/api/**/*.ts": {
            "runtime": "nodejs18.x"
          }
        },
        "env": {
          "NODE_ENV": "production"
        }
      };

      const configJson = JSON.stringify(config, null, 2);
      
      // Backup existing vercel.json if it exists
      if (existsSync(this.vercelJsonPath)) {
        const backupPath = `${this.vercelJsonPath}.backup.${Date.now()}`;
        const existingConfig = readFileSync(this.vercelJsonPath, 'utf8');
        writeFileSync(backupPath, existingConfig);
        console.log(`📦 Backed up existing vercel.json to: ${backupPath}`);
      }
      
      // Write new configuration
      writeFileSync(this.vercelJsonPath, configJson);
      console.log('✅ Generated optimized vercel.json configuration');
      console.log('📁 Configuration saved to:', this.vercelJsonPath);
      
      return configJson;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ Failed to generate vercel.json:', errorMsg);
      throw error;
    }
  }

  /**
   * Strategy 3: Test Vercel CLI Deployment
   */
  async testCliDeployment(): Promise<DeploymentResult> {
    console.log('🎯 Strategy 3: Vercel CLI Deployment');
    
    const result: DeploymentResult = {
      success: false,
      buildLogs: []
    };

    try {
      // Check if Vercel CLI is installed
      try {
        execSync('vercel --version', { encoding: 'utf8' });
        console.log('✅ Vercel CLI is available');
      } catch {
        result.error = 'Vercel CLI not installed. Install with: npm i -g vercel';
        console.error('❌ Vercel CLI not found');
        return result;
      }

      // Generate CLI-specific vercel.json
      const cliConfig = {
        "version": 2,
        "framework": "nextjs",
        "buildCommand": "npm run build",
        "outputDirectory": ".next",
        "installCommand": "npm install",
        "functions": {
          "src/app/api/**/*.ts": {
            "runtime": "nodejs18.x"
          }
        }
      };

      const cliConfigPath = join(this.webAppPath, 'vercel.json');
      writeFileSync(cliConfigPath, JSON.stringify(cliConfig, null, 2));
      console.log('📁 Created CLI-specific vercel.json in web app directory');

      // Prepare CLI deployment command
      const deployCommand = 'vercel --prod --confirm';
      console.log('🚀 CLI deployment command prepared:', deployCommand);
      console.log('⚠️  Note: CLI deployment requires manual execution due to authentication');
      
      // Generate deployment script
      const deployScript = this.generateCliDeploymentScript();
      const scriptPath = join(this.projectRoot, 'deploy-cli.sh');
      writeFileSync(scriptPath, deployScript);
      console.log('📜 CLI deployment script generated:', scriptPath);
      
      result.success = true;
      console.log('✅ CLI deployment preparation completed');
      
      return result;

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error('❌ CLI deployment preparation failed:', result.error);
      return result;
    }
  }

  /**
   * Strategy 4: Create Separate Project Configuration
   */
  async createSeparateProject(): Promise<ProjectResult> {
    console.log('🎯 Strategy 4: Separate Project Deployment');
    
    const result: ProjectResult = {
      success: false
    };

    try {
      // Generate separate project configuration
      const separateConfig = {
        "version": 2,
        "name": "syspro-web-standalone",
        "framework": "nextjs",
        "buildCommand": "npm run build",
        "outputDirectory": ".next",
        "installCommand": "npm install",
        "functions": {
          "src/app/api/**/*.ts": {
            "runtime": "nodejs18.x"
          }
        },
        "env": {
          "NODE_ENV": "production"
        }
      };

      // Create separate project instructions
      const instructions = this.generateSeparateProjectInstructions();
      const instructionsPath = join(this.projectRoot, 'SEPARATE_PROJECT_SETUP.md');
      writeFileSync(instructionsPath, instructions);
      
      // Create standalone vercel.json for web app
      const standaloneConfigPath = join(this.webAppPath, 'vercel-standalone.json');
      writeFileSync(standaloneConfigPath, JSON.stringify(separateConfig, null, 2));
      
      console.log('📋 Separate project setup instructions generated:');
      console.log(`   Instructions: ${instructionsPath}`);
      console.log(`   Config: ${standaloneConfigPath}`);
      
      result.success = true;
      console.log('✅ Separate project configuration completed');
      
      return result;

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error('❌ Separate project setup failed:', result.error);
      return result;
    }
  }

  /**
   * Test routes on a deployed URL
   */
  async testDeployedRoutes(baseUrl: string): Promise<RouteTestResult[]> {
    console.log(`🧪 Testing routes on: ${baseUrl}`);
    
    const testRoutes = [
      { route: '/', expectedStatus: 200 },
      { route: '/test', expectedStatus: 200 },
      { route: '/login', expectedStatus: 200 },
      { route: '/api/health', expectedStatus: 200 }
    ];

    const results: RouteTestResult[] = [];

    for (const testRoute of testRoutes) {
      const startTime = Date.now();
      
      try {
        const response = await axios.get(`${baseUrl}${testRoute.route}`, {
          timeout: 10000,
          validateStatus: () => true // Don't throw on non-2xx status codes
        });

        const responseTime = Date.now() - startTime;
        const success = response.status === testRoute.expectedStatus;

        results.push({
          route: testRoute.route,
          status: response.status,
          success,
          responseTime
        });

        const statusIcon = success ? '✅' : '❌';
        console.log(`   ${statusIcon} ${testRoute.route} - ${response.status} (${responseTime}ms)`);

      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        results.push({
          route: testRoute.route,
          status: 0,
          success: false,
          responseTime,
          error: errorMsg
        });

        console.log(`   ❌ ${testRoute.route} - Error: ${errorMsg} (${responseTime}ms)`);
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`\n📊 Route test summary: ${successCount}/${results.length} routes passed`);

    return results;
  }

  /**
   * Generate dashboard configuration instructions
   */
  private generateDashboardInstructions(): string {
    return `# Vercel Dashboard Configuration Instructions

## 🎯 Strategy 1: Manual Dashboard Configuration

This is the **RECOMMENDED** approach for fixing Next.js routing in monorepo deployments.

### Step-by-Step Instructions:

#### 1. Access Vercel Dashboard
- Go to: https://vercel.com/dashboard
- Find your project: **syspro** (or similar name)
- Click on the project name to open project settings

#### 2. Configure Root Directory
- Navigate to: **Settings** tab
- Scroll down to: **Root Directory** section
- Current setting: \`.\" (root directory)
- **Change to**: \`apps/web\`
- Click: **Save** button

#### 3. Configure Build Settings (if needed)
- In the same Settings page, find: **Build & Output Settings**
- **Build Command**: Should be \`npm run build\` (default is fine)
- **Output Directory**: Should be \`.next\` (default is fine)
- **Install Command**: Should be \`npm install\` (default is fine)

#### 4. Trigger Redeploy
- Navigate to: **Deployments** tab
- Find the latest deployment
- Click: **⋯** (three dots menu)
- Select: **Redeploy**
- Wait for deployment to complete

### Expected Results After Configuration:

✅ **Working Routes:**
- \`/\` - Main application page
- \`/test\` - Test page with success message
- \`/login\` - Login form page
- \`/api/health\` - JSON health status

### Verification Steps:

1. **Test Routes**: Visit each route to confirm 200 status
2. **Check Build Logs**: Verify "Next.js" framework detection
3. **API Endpoints**: Confirm JSON responses from API routes

### If This Strategy Fails:

Try the next strategy: **Optimized vercel.json Configuration**

Run: \`npm run deploy:strategy2\`

---

**📝 Note**: This manual configuration is the most reliable method for monorepo Next.js deployments on Vercel.
`;
  }

  /**
   * Generate CLI deployment script
   */
  private generateCliDeploymentScript(): string {
    return `#!/bin/bash

# Vercel CLI Deployment Script
# Strategy 3: Direct CLI deployment with explicit Next.js configuration

echo "🚀 Starting Vercel CLI deployment..."

# Navigate to web app directory
cd apps/web

# Ensure Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Login to Vercel (if not already logged in)
echo "🔐 Checking Vercel authentication..."
vercel whoami || vercel login

# Deploy with explicit Next.js framework
echo "📦 Deploying with explicit Next.js configuration..."
vercel --prod --confirm --framework nextjs

echo "✅ CLI deployment completed!"
echo "🧪 Test your routes after deployment completes."
`;
  }

  /**
   * Generate separate project setup instructions
   */
  private generateSeparateProjectInstructions(): string {
    return `# Separate Vercel Project Setup Instructions

## 🎯 Strategy 4: Standalone Project Deployment

This approach creates a completely separate Vercel project for just the web application.

### Step-by-Step Instructions:

#### 1. Create New Repository (Option A - Recommended)
\`\`\`bash
# Create a new directory for standalone web app
mkdir syspro-web-standalone
cd syspro-web-standalone

# Copy web app files
cp -r ../apps/web/* .
cp ../apps/web/.* . 2>/dev/null || true

# Initialize new git repository
git init
git add .
git commit -m "Initial commit - standalone web app"

# Push to new GitHub repository
# (Create new repo on GitHub first)
git remote add origin https://github.com/yourusername/syspro-web-standalone.git
git push -u origin main
\`\`\`

#### 2. Deploy New Repository to Vercel
- Go to: https://vercel.com/dashboard
- Click: **Add New Project**
- Import: Your new standalone repository
- Framework: **Next.js** (should auto-detect)
- Deploy: Click **Deploy**

#### 3. Alternative: Direct Directory Deployment (Option B)
\`\`\`bash
# Navigate to web app directory
cd apps/web

# Copy the generated standalone config
cp vercel-standalone.json vercel.json

# Deploy directly from this directory
vercel --prod --confirm
\`\`\`

### Benefits of This Approach:

✅ **Clean Separation**: No monorepo complexity
✅ **Automatic Detection**: Vercel easily detects Next.js
✅ **Independent Deployments**: Web app deploys independently
✅ **Simplified Configuration**: Standard Next.js deployment

### Considerations:

⚠️ **Code Duplication**: Shared code needs to be copied/maintained
⚠️ **Separate Repository**: Additional repository to manage
⚠️ **Deployment Coordination**: API and web deployments are separate

---

**📝 Note**: This approach is most suitable when other strategies fail or when you want completely independent deployments.
`;
  }
}

// CLI execution
if (require.main === module) {
  async function main() {
    const manager = new VercelConfigManager();
    const strategy = process.argv[2] || 'dashboard';
    
    console.log('🚀 Starting Vercel Configuration Manager...\n');
    
    switch (strategy) {
      case 'dashboard':
      case '1':
        await manager.applyDashboardConfig();
        break;
        
      case 'vercel-json':
      case '2':
        await manager.generateOptimalVercelJson();
        break;
        
      case 'cli':
      case '3':
        await manager.testCliDeployment();
        break;
        
      case 'separate':
      case '4':
        await manager.createSeparateProject();
        break;
        
      case 'test':
        const url = process.argv[3];
        if (!url) {
          console.error('❌ Please provide a URL to test: npm run vercel-config test <url>');
          process.exit(1);
        }
        await manager.testDeployedRoutes(url);
        break;
        
      default:
        console.log('📋 Available strategies:');
        console.log('   1. dashboard - Generate dashboard configuration instructions');
        console.log('   2. vercel-json - Generate optimized vercel.json');
        console.log('   3. cli - Prepare CLI deployment');
        console.log('   4. separate - Setup separate project deployment');
        console.log('   test <url> - Test routes on deployed URL');
        console.log('\nUsage: npm run vercel-config <strategy>');
    }
  }
  
  main().catch(error => {
    console.error('❌ Vercel configuration failed:', error);
    process.exit(1);
  });
}

// Export is already done above with the class declaration