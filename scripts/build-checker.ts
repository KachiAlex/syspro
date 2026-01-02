#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface BuildStatus {
  success: boolean;
  errors: string[];
  warnings: string[];
  timestamp: Date;
}

export interface BuildOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class BuildChecker {
  private errors: string[] = [];
  private warnings: string[] = [];

  /**
   * Verifies TypeScript compiler access to dependencies
   * Implements Requirements 2.1
   */
  verifyTypescriptCompilerAccess(): boolean {
    try {
      // Check if TypeScript is available
      const tsVersion = execSync('npx tsc --version', { 
        encoding: 'utf8',
        timeout: 10000 
      }).trim();
      
      console.log(`TypeScript compiler found: ${tsVersion}`);
      return true;
    } catch (error) {
      this.errors.push(`TypeScript compiler not accessible: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Validates build success for a specific project
   * Implements Requirements 2.3, 2.4
   */
  validateBuildSuccess(projectPath: string): BuildStatus {
    const timestamp = new Date();
    this.errors = [];
    this.warnings = [];

    try {
      // Check if package.json exists
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        this.errors.push(`No package.json found in ${projectPath}`);
        return { success: false, errors: this.errors, warnings: this.warnings, timestamp };
      }

      // Check if TypeScript config exists
      const tsconfigPath = path.join(projectPath, 'tsconfig.json');
      if (!fs.existsSync(tsconfigPath)) {
        this.warnings.push(`No tsconfig.json found in ${projectPath}`);
      }

      // Run type checking
      const typeCheckResult = this.runTypeCheck(projectPath);
      if (!typeCheckResult.success) {
        this.errors.push(...typeCheckResult.errors);
        return { success: false, errors: this.errors, warnings: this.warnings, timestamp };
      }

      // Run build if build script exists
      const buildResult = this.runBuild(projectPath);
      if (!buildResult.success) {
        this.errors.push(...buildResult.errors);
        return { success: false, errors: this.errors, warnings: this.warnings, timestamp };
      }

      // Verify build output
      const outputVerification = this.verifyBuildOutput(projectPath);
      if (!outputVerification.success) {
        this.errors.push(...outputVerification.errors);
        return { success: false, errors: this.errors, warnings: this.warnings, timestamp };
      }

      return { success: true, errors: this.errors, warnings: this.warnings, timestamp };
    } catch (error) {
      this.errors.push(`Build validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, errors: this.errors, warnings: this.warnings, timestamp };
    }
  }

  /**
   * Runs TypeScript type checking
   * Implements Requirements 2.3
   */
  private runTypeCheck(projectPath: string): BuildStatus {
    const timestamp = new Date();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const result = execSync('npx tsc --noEmit', {
        cwd: projectPath,
        encoding: 'utf8',
        timeout: 60000
      });

      console.log('TypeScript type check passed');
      return { success: true, errors, warnings, timestamp };
    } catch (error: any) {
      if (error.stdout) {
        // Parse TypeScript errors
        const tsErrors = this.parseTypescriptErrors(error.stdout);
        errors.push(...tsErrors);
      }
      if (error.stderr) {
        errors.push(`Type check stderr: ${error.stderr}`);
      }
      
      return { success: false, errors, warnings, timestamp };
    }
  }

  /**
   * Runs the build process
   * Implements Requirements 2.4
   */
  private runBuild(projectPath: string): BuildStatus {
    const timestamp = new Date();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if build script exists
      const packageJson = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8'));
      if (!packageJson.scripts?.build) {
        warnings.push('No build script found in package.json');
        return { success: true, errors, warnings, timestamp };
      }

      // Run build
      const result = execSync('npm run build', {
        cwd: projectPath,
        encoding: 'utf8',
        timeout: 300000 // 5 minutes
      });

      console.log('Build completed successfully');
      return { success: true, errors, warnings, timestamp };
    } catch (error: any) {
      if (error.stdout) {
        errors.push(`Build stdout: ${error.stdout}`);
      }
      if (error.stderr) {
        errors.push(`Build stderr: ${error.stderr}`);
      }
      
      return { success: false, errors, warnings, timestamp };
    }
  }

  /**
   * Verifies build output exists and is valid
   * Implements Requirements 2.4, 3.3
   */
  private verifyBuildOutput(projectPath: string): BuildStatus {
    const timestamp = new Date();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Common build output directories
      const possibleOutputDirs = [
        path.join(projectPath, 'dist'),
        path.join(projectPath, 'build'),
        path.join(projectPath, '.next'),
        path.join(projectPath, 'out')
      ];

      let outputFound = false;
      for (const outputDir of possibleOutputDirs) {
        if (fs.existsSync(outputDir)) {
          outputFound = true;
          console.log(`Build output found at: ${outputDir}`);
          
          // Check if output directory has content
          const files = fs.readdirSync(outputDir);
          if (files.length === 0) {
            warnings.push(`Build output directory ${outputDir} is empty`);
          }
          break;
        }
      }

      if (!outputFound) {
        warnings.push('No build output directory found (dist, build, .next, or out)');
      }

      return { success: true, errors, warnings, timestamp };
    } catch (error) {
      errors.push(`Build output verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, errors, warnings, timestamp };
    }
  }

  /**
   * Parses TypeScript compiler errors
   */
  private parseTypescriptErrors(output: string): string[] {
    const errors: string[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('error TS')) {
        errors.push(line.trim());
      }
    }
    
    return errors;
  }

  /**
   * Comprehensive build verification for all projects
   * Implements Requirements 3.4
   */
  validateAllBuilds(): { [project: string]: BuildStatus } {
    const projects = [
      { name: 'web', path: 'apps/web' },
      { name: 'api', path: 'apps/api' },
      { name: 'shared', path: 'libs/shared' },
      { name: 'database', path: 'libs/database' }
    ];

    const results: { [project: string]: BuildStatus } = {};

    // First verify TypeScript compiler access
    if (!this.verifyTypescriptCompilerAccess()) {
      const failedStatus: BuildStatus = {
        success: false,
        errors: this.errors,
        warnings: this.warnings,
        timestamp: new Date()
      };
      
      // Mark all projects as failed if TypeScript is not accessible
      projects.forEach(project => {
        results[project.name] = failedStatus;
      });
      
      return results;
    }

    // Validate each project
    for (const project of projects) {
      if (fs.existsSync(project.path)) {
        console.log(`\nValidating build for ${project.name}...`);
        results[project.name] = this.validateBuildSuccess(project.path);
      } else {
        results[project.name] = {
          success: false,
          errors: [`Project path ${project.path} does not exist`],
          warnings: [],
          timestamp: new Date()
        };
      }
    }

    return results;
  }

  /**
   * Get summary of all build results
   */
  getBuildSummary(results: { [project: string]: BuildStatus }): {
    totalProjects: number;
    successfulBuilds: number;
    failedBuilds: number;
    overallSuccess: boolean;
  } {
    const totalProjects = Object.keys(results).length;
    const successfulBuilds = Object.values(results).filter(r => r.success).length;
    const failedBuilds = totalProjects - successfulBuilds;
    
    return {
      totalProjects,
      successfulBuilds,
      failedBuilds,
      overallSuccess: failedBuilds === 0
    };
  }
}

// CLI usage
if (require.main === module) {
  const checker = new BuildChecker();
  
  console.log('Build Verification Starting...');
  console.log('==============================');
  
  const results = checker.validateAllBuilds();
  const summary = checker.getBuildSummary(results);
  
  // Print results
  Object.entries(results).forEach(([project, status]) => {
    console.log(`\n${project.toUpperCase()}:`);
    console.log(`  Status: ${status.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`  Timestamp: ${status.timestamp.toISOString()}`);
    
    if (status.errors.length > 0) {
      console.log('  Errors:');
      status.errors.forEach(error => console.log(`    - ${error}`));
    }
    
    if (status.warnings.length > 0) {
      console.log('  Warnings:');
      status.warnings.forEach(warning => console.log(`    - ${warning}`));
    }
  });
  
  console.log('\nBUILD SUMMARY:');
  console.log('==============');
  console.log(`Total Projects: ${summary.totalProjects}`);
  console.log(`Successful Builds: ${summary.successfulBuilds}`);
  console.log(`Failed Builds: ${summary.failedBuilds}`);
  console.log(`Overall Status: ${summary.overallSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  process.exit(summary.overallSuccess ? 0 : 1);
}