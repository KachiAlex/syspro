#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface ValidationResult {
  passed: boolean;
  issues: string[];
}

interface DeploymentValidationResults {
  packageValidation: ValidationResult;
  dependencyValidation: ValidationResult;
  configValidation: ValidationResult;
  buildValidation: ValidationResult;
  deploymentReadiness: ValidationResult;
  overallStatus: boolean;
}

export class PreDeploymentChecker {
  private results: DeploymentValidationResults;

  constructor() {
    this.results = {
      packageValidation: { passed: false, issues: [] },
      dependencyValidation: { passed: false, issues: [] },
      configValidation: { passed: false, issues: [] },
      buildValidation: { passed: false, issues: [] },
      deploymentReadiness: { passed: false, issues: [] },
      overallStatus: false
    };
  }

  /**
   * Validates package.json configurations
   * Implements Requirements 4.1, 4.4
   */
  validatePackageConfigurations(): boolean {
    console.log('📦 Validating package configurations...');
    
    const packagePaths = [
      'package.json',
      'apps/web/package.json',
      'apps/api/package.json',
      'libs/shared/package.json',
      'libs/database/package.json'
    ];

    let allValid = true;
    const issues: string[] = [];

    for (const packagePath of packagePaths) {
      if (!fs.existsSync(packagePath)) {
        issues.push(`Missing package.json: ${packagePath}`);
        allValid = false;
        continue;
      }

      try {
        const content = fs.readFileSync(packagePath, 'utf8');
        
        // Check for duplicate dependency sections
        if (this.hasDuplicateSections(content)) {
          issues.push(`Duplicate dependency sections in ${packagePath}`);
          allValid = false;
        }

        // Parse and validate JSON structure
        const packageJson = JSON.parse(content);
        
        // Validate required fields
        if (!packageJson.name) {
          issues.push(`Missing name field in ${packagePath}`);
          allValid = false;
        }
        
        if (!packageJson.version) {
          issues.push(`Missing version field in ${packagePath}`);
          allValid = false;
        }

        // Validate scripts for buildable packages
        if (packagePath.includes('apps/') || packagePath.includes('libs/')) {
          if (!packageJson.scripts || !packageJson.scripts.build) {
            issues.push(`Missing build script in ${packagePath}`);
            allValid = false;
          }
        }

      } catch (error) {
        issues.push(`Failed to parse ${packagePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        allValid = false;
      }
    }

    this.results.packageValidation = { passed: allValid, issues };
    return allValid;
  }

  /**
   * Validates TypeScript and workspace dependencies
   * Implements Requirements 1.4, 2.1, 4.2
   */
  validateDependencies(): boolean {
    console.log('🔗 Validating dependencies...');
    
    let allValid = true;
    const issues: string[] = [];

    // Check web app TypeScript dependencies
    const webPackagePath = 'apps/web/package.json';
    if (fs.existsSync(webPackagePath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(webPackagePath, 'utf8'));
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies
        };

        // Check required TypeScript dependencies
        const requiredTypescriptDeps = ['typescript', '@types/node', '@types/react'];
        const missingDeps = requiredTypescriptDeps.filter(dep => !allDeps[dep]);
        
        if (missingDeps.length > 0) {
          issues.push(`Missing TypeScript dependencies in web app: ${missingDeps.join(', ')}`);
          allValid = false;
        }

        // Validate workspace dependencies exist
        const workspaceDeps = Object.entries(allDeps).filter(([_, version]) => 
          typeof version === 'string' && version.startsWith('workspace:')
        );

        for (const [depName, version] of workspaceDeps) {
          if (version === 'workspace:*') {
            const workspacePath = this.resolveWorkspacePath(depName);
            if (!fs.existsSync(workspacePath)) {
              issues.push(`Workspace dependency ${depName} not found at ${workspacePath}`);
              allValid = false;
            }
          }
        }

        // Check for known problematic dependencies
        const problematicDeps = [
          '@next/eslint-config-next' // Should be eslint-config-next
        ];

        for (const problematicDep of problematicDeps) {
          if (allDeps[problematicDep]) {
            issues.push(`Problematic dependency found: ${problematicDep} (should be ${problematicDep.replace('@next/', '')})`);
            allValid = false;
          }
        }

      } catch (error) {
        issues.push(`Failed to validate web app dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`);
        allValid = false;
      }
    }

    this.results.dependencyValidation = { passed: allValid, issues };
    return allValid;
  }

  /**
   * Validates Vercel and build configurations
   * Implements Requirements 4.1, 4.4
   */
  validateConfigurations(): boolean {
    console.log('⚙️  Validating configurations...');
    
    let allValid = true;
    const issues: string[] = [];

    // Validate Vercel configuration
    if (fs.existsSync('vercel.json')) {
      try {
        const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
        
        if (!vercelConfig.builds || vercelConfig.builds.length === 0) {
          issues.push('Vercel configuration missing builds section');
          allValid = false;
        }

        // Check for proper build configuration
        const webBuild = vercelConfig.builds.find((build: any) => 
          build.src && build.src.includes('apps/web')
        );
        
        if (!webBuild) {
          issues.push('Vercel configuration missing web app build configuration');
          allValid = false;
        }

      } catch (error) {
        issues.push(`Invalid Vercel configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        allValid = false;
      }
    } else {
      issues.push('Missing vercel.json configuration file');
      allValid = false;
    }

    // Validate TypeScript configurations
    const tsconfigPaths = [
      'tsconfig.json',
      'apps/web/tsconfig.json',
      'apps/api/tsconfig.json'
    ];

    for (const tsconfigPath of tsconfigPaths) {
      if (fs.existsSync(tsconfigPath)) {
        try {
          const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
          
          if (!tsconfig.compilerOptions) {
            issues.push(`TypeScript config ${tsconfigPath} missing compilerOptions`);
            allValid = false;
          }

        } catch (error) {
          issues.push(`Invalid TypeScript config ${tsconfigPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          allValid = false;
        }
      }
    }

    // Validate Turbo configuration
    if (fs.existsSync('turbo.json')) {
      try {
        const turboConfig = JSON.parse(fs.readFileSync('turbo.json', 'utf8'));
        
        if (!turboConfig.pipeline) {
          issues.push('Turbo configuration missing pipeline section');
          allValid = false;
        }

        // Check for build pipeline
        if (!turboConfig.pipeline.build) {
          issues.push('Turbo configuration missing build pipeline');
          allValid = false;
        }

      } catch (error) {
        issues.push(`Invalid Turbo configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        allValid = false;
      }
    }

    this.results.configValidation = { passed: allValid, issues };
    return allValid;
  }

  /**
   * Validates build readiness without running full build
   * Implements Requirements 2.3, 2.4
   */
  validateBuildReadiness(): boolean {
    console.log('🏗️  Validating build readiness...');
    
    let allValid = true;
    const issues: string[] = [];

    // Check if TypeScript compiler is accessible
    try {
      // Try multiple ways to check TypeScript availability
      let tsAvailable = false;
      
      try {
        // First try npx
        const tsVersion = execSync('npx tsc --version', { 
          encoding: 'utf8',
          timeout: 10000,
          stdio: 'pipe'
        }).trim();
        console.log(`   TypeScript compiler available via npx: ${tsVersion}`);
        tsAvailable = true;
      } catch (npxError) {
        // Try direct tsc command
        try {
          const tsVersion = execSync('tsc --version', { 
            encoding: 'utf8',
            timeout: 5000,
            stdio: 'pipe'
          }).trim();
          console.log(`   TypeScript compiler available globally: ${tsVersion}`);
          tsAvailable = true;
        } catch (globalError) {
          // Check if TypeScript is in package.json dependencies
          const webPackage = JSON.parse(fs.readFileSync('apps/web/package.json', 'utf8'));
          const allDeps = { ...webPackage.dependencies, ...webPackage.devDependencies };
          
          if (allDeps.typescript) {
            console.log(`   TypeScript declared in dependencies: ${allDeps.typescript}`);
            tsAvailable = true;
          } else {
            issues.push('TypeScript compiler not accessible and not declared in dependencies');
            allValid = false;
          }
        }
      }
      
    } catch (error) {
      issues.push('Failed to check TypeScript compiler availability');
      allValid = false;
    }

    // Check critical build files exist
    const criticalFiles = [
      'apps/web/next.config.js',
      'apps/web/tailwind.config.js',
      'apps/web/src/app/layout.tsx',
      'apps/web/src/app/page.tsx'
    ];

    for (const file of criticalFiles) {
      if (!fs.existsSync(file)) {
        issues.push(`Missing critical build file: ${file}`);
        allValid = false;
      }
    }

    // Check for common build-breaking patterns
    const webSrcPath = 'apps/web/src';
    if (fs.existsSync(webSrcPath)) {
      try {
        // Check for TypeScript files with potential issues
        this.checkForCommonBuildIssues(webSrcPath, issues);
      } catch (error) {
        issues.push(`Failed to check for build issues: ${error instanceof Error ? error.message : 'Unknown error'}`);
        allValid = false;
      }
    }

    this.results.buildValidation = { passed: allValid, issues };
    return allValid;
  }

  /**
   * Validates overall deployment readiness
   * Implements Requirements 4.3, 4.4
   */
  validateDeploymentReadiness(): boolean {
    console.log('🚀 Validating deployment readiness...');
    
    let allValid = true;
    const issues: string[] = [];

    // Check environment configuration
    const envFiles = [
      'apps/web/.env.example',
      '.env.example',
      '.env.production.template'
    ];

    let hasEnvConfig = false;
    for (const envFile of envFiles) {
      if (fs.existsSync(envFile)) {
        hasEnvConfig = true;
        break;
      }
    }

    if (!hasEnvConfig) {
      issues.push('No environment configuration files found');
      allValid = false;
    }

    // Check deployment scripts
    const rootPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const deploymentScripts = ['vercel-build', 'build:vercel'];
    
    let hasDeploymentScript = false;
    for (const script of deploymentScripts) {
      if (rootPackage.scripts && rootPackage.scripts[script]) {
        hasDeploymentScript = true;
        break;
      }
    }

    if (!hasDeploymentScript) {
      issues.push('No deployment build script found in root package.json');
      allValid = false;
    }

    // Check for deployment blockers
    const deploymentBlockers = [
      'node_modules', // Should not be committed
      '.env', // Should not be committed
      'dist', // Should not be committed
      '.next' // Should not be committed
    ];

    for (const blocker of deploymentBlockers) {
      if (fs.existsSync(blocker)) {
        // Check if it's properly gitignored
        if (fs.existsSync('.gitignore')) {
          const gitignore = fs.readFileSync('.gitignore', 'utf8');
          if (!gitignore.includes(blocker)) {
            issues.push(`Deployment blocker ${blocker} exists and is not gitignored`);
            allValid = false;
          }
        }
      }
    }

    this.results.deploymentReadiness = { passed: allValid, issues };
    return allValid;
  }

  /**
   * Checks for common build issues in source files
   */
  private checkForCommonBuildIssues(srcPath: string, issues: string[]): void {
    // This is a simplified check - in a real implementation, you might use AST parsing
    const checkFile = (filePath: string) => {
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Check for missing imports (more accurate check)
          if (filePath.endsWith('.tsx')) {
            // For TSX files, check if they use React types but don't import React
            const hasReactTypes = content.includes('React.ReactNode') || 
                                content.includes('React.Component') ||
                                content.includes('React.FC');
            const hasReactImport = content.includes('import React') || 
                                 content.includes('from "react"') ||
                                 content.includes('from \'react\'');
            
            if (hasReactTypes && !hasReactImport) {
              issues.push(`Missing React import for React types in ${filePath}`);
            }
          }
          
        } catch (error) {
          // Skip files that can't be read
        }
      }
    };

    const walkDir = (dir: string) => {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            walkDir(filePath);
          } else {
            checkFile(filePath);
          }
        }
      } catch (error) {
        // Skip directories that can't be read
      }
    };

    walkDir(srcPath);
  }

  /**
   * Detects duplicate dependency sections
   */
  private hasDuplicateSections(content: string): boolean {
    const lines = content.split('\n');
    const dependenciesCount = lines.filter(line => 
      line.trim().startsWith('"dependencies"')
    ).length;
    const devDependenciesCount = lines.filter(line => 
      line.trim().startsWith('"devDependencies"')
    ).length;
    
    return dependenciesCount > 1 || devDependenciesCount > 1;
  }

  /**
   * Resolves workspace package path
   */
  private resolveWorkspacePath(packageName: string): string {
    const name = packageName.replace('@syspro/', '');
    return path.join('libs', name, 'package.json');
  }

  /**
   * Runs comprehensive pre-deployment validation
   */
  runPreDeploymentCheck(): boolean {
    console.log('🔍 Pre-Deployment Validation Starting...');
    console.log('=========================================\n');

    // Run all validations
    const packageValid = this.validatePackageConfigurations();
    const dependencyValid = this.validateDependencies();
    const configValid = this.validateConfigurations();
    const buildValid = this.validateBuildReadiness();
    const deploymentValid = this.validateDeploymentReadiness();

    // Overall status
    this.results.overallStatus = packageValid && dependencyValid && configValid && buildValid && deploymentValid;

    // Print results
    this.printResults();

    return this.results.overallStatus;
  }

  /**
   * Prints validation results
   */
  private printResults(): void {
    console.log('\n📊 PRE-DEPLOYMENT VALIDATION RESULTS');
    console.log('====================================\n');

    const sections = [
      { name: '📦 Package Configuration', result: this.results.packageValidation },
      { name: '🔗 Dependencies', result: this.results.dependencyValidation },
      { name: '⚙️  Configuration Files', result: this.results.configValidation },
      { name: '🏗️  Build Readiness', result: this.results.buildValidation },
      { name: '🚀 Deployment Readiness', result: this.results.deploymentReadiness }
    ];

    for (const section of sections) {
      console.log(`${section.name}:`);
      console.log(`   Status: ${section.result.passed ? '✅ PASSED' : '❌ FAILED'}`);
      
      if (section.result.issues.length > 0) {
        console.log('   Issues:');
        section.result.issues.forEach(issue => {
          console.log(`     - ${issue}`);
        });
      }
      console.log();
    }

    console.log('🎯 OVERALL DEPLOYMENT STATUS:');
    console.log(`   ${this.results.overallStatus ? '✅ READY FOR DEPLOYMENT' : '❌ NOT READY - Issues must be resolved'}`);
    console.log();

    if (this.results.overallStatus) {
      console.log('🎉 All validations passed! The application is ready for deployment.');
      console.log('   You can proceed with:');
      console.log('   - git push to trigger Vercel deployment');
      console.log('   - Manual deployment via Vercel CLI');
    } else {
      console.log('⚠️  Deployment validation failed. Please resolve the issues above before deploying.');
      console.log('   Common fixes:');
      console.log('   - Run package validation and fix any duplicate sections');
      console.log('   - Ensure all TypeScript dependencies are installed');
      console.log('   - Verify configuration files are valid JSON');
      console.log('   - Check that all required files exist');
    }
  }

  /**
   * Get validation results
   */
  getResults(): DeploymentValidationResults {
    return this.results;
  }
}

// CLI usage
if (require.main === module) {
  const checker = new PreDeploymentChecker();
  const success = checker.runPreDeploymentCheck();
  
  process.exit(success ? 0 : 1);
}