#!/usr/bin/env node

/**
 * Comprehensive Pre-Deployment Validation Script
 * Integrates all validation checks and provides deployment readiness report
 * Implements Requirements 3.4, 4.1
 */

import { ErrorReporter } from './error-reporter';
const { PackageValidator } = require('./validate-packages.js');
const { BuildChecker } = require('./build-check.js');
import { PreDeploymentChecker } from './pre-deployment-checker';
import * as fs from 'fs';

interface DeploymentReport {
  timestamp: string;
  overallStatus: 'READY' | 'BLOCKED' | 'WARNINGS';
  validationResults: {
    packageValidation: boolean;
    dependencyValidation: boolean;
    configValidation: boolean;
    buildValidation: boolean;
    deploymentReadiness: boolean;
  };
  errorSummary: {
    totalErrors: number;
    totalWarnings: number;
    criticalIssues: number;
  };
  recommendations: string[];
  nextSteps: string[];
}

export class DeploymentValidator {
  private errorReporter: ErrorReporter;
  private packageValidator: PackageValidator;
  private buildChecker: BuildChecker;
  private preDeploymentChecker: PreDeploymentChecker;

  constructor() {
    this.errorReporter = new ErrorReporter();
    this.packageValidator = new PackageValidator();
    this.buildChecker = new BuildChecker();
    this.preDeploymentChecker = new PreDeploymentChecker();
  }

  /**
   * Runs comprehensive deployment validation
   * Implements Requirements 3.4, 4.1
   */
  async validateDeployment(): Promise<DeploymentReport> {
    console.log('🚀 COMPREHENSIVE DEPLOYMENT VALIDATION');
    console.log('=====================================\n');

    const timestamp = new Date().toISOString();
    let overallStatus: 'READY' | 'BLOCKED' | 'WARNINGS' = 'READY';

    // Step 1: Package Configuration Validation
    console.log('Step 1: Package Configuration Validation');
    console.log('----------------------------------------');
    const packageResult = this.packageValidator.validateAllPackages();
    
    if (!packageResult.packageConfigValid) {
      packageResult.issues.forEach(issue => {
        this.errorReporter.addPackageError(issue, this.extractFileFromIssue(issue));
      });
    }

    if (!packageResult.typescriptDepsAvailable) {
      this.errorReporter.addDependencyError(
        'TypeScript dependencies not available',
        'apps/web/package.json',
        'Run: npm install --save-dev typescript @types/node @types/react'
      );
    }

    // Step 2: Build System Validation
    console.log('\nStep 2: Build System Validation');
    console.log('-------------------------------');
    
    try {
      const buildResults = this.buildChecker.validateAllBuilds();
      const buildSummary = this.buildChecker.getBuildSummary(buildResults);
      
      if (!buildSummary.overallSuccess) {
        Object.entries(buildResults).forEach(([project, result]) => {
          if (!result.success) {
            result.errors.forEach(error => {
              this.errorReporter.addBuildError(error, `${project} project`);
            });
          }
        });
      }
    } catch (error) {
      this.errorReporter.addBuildError(
        `Build validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        'Ensure all dependencies are installed and build tools are accessible'
      );
    }

    // Step 3: Pre-Deployment Checks
    console.log('\nStep 3: Pre-Deployment Checks');
    console.log('-----------------------------');
    const preDeploymentSuccess = this.preDeploymentChecker.runPreDeploymentCheck();
    const preDeploymentResults = this.preDeploymentChecker.getResults();

    // Integrate pre-deployment results into error reporter
    this.integratePreDeploymentResults(preDeploymentResults);

    // Step 4: Generate Report
    console.log('\nStep 4: Generating Deployment Report');
    console.log('-----------------------------------');
    
    const errorSummary = this.errorReporter.getErrorSummary();
    
    // Determine overall status
    if (errorSummary.hasBlockingErrors) {
      overallStatus = 'BLOCKED';
    } else if (errorSummary.totalWarnings > 0) {
      overallStatus = 'WARNINGS';
    }

    const report: DeploymentReport = {
      timestamp,
      overallStatus,
      validationResults: {
        packageValidation: packageResult.packageConfigValid,
        dependencyValidation: packageResult.typescriptDepsAvailable,
        configValidation: preDeploymentResults.configValidation.passed,
        buildValidation: preDeploymentResults.buildValidation.passed,
        deploymentReadiness: preDeploymentResults.deploymentReadiness.passed
      },
      errorSummary: {
        totalErrors: errorSummary.totalErrors,
        totalWarnings: errorSummary.totalWarnings,
        criticalIssues: errorSummary.criticalIssues.length
      },
      recommendations: this.generateRecommendations(errorSummary),
      nextSteps: this.generateNextSteps(overallStatus, errorSummary)
    };

    // Print comprehensive report
    this.printDeploymentReport(report);

    // Save report to file
    await this.saveReportToFile(report);

    return report;
  }

  /**
   * Integrates pre-deployment results into error reporter
   */
  private integratePreDeploymentResults(results: any): void {
    // Package validation issues
    results.packageValidation.issues.forEach((issue: string) => {
      this.errorReporter.addPackageError(issue, this.extractFileFromIssue(issue));
    });

    // Dependency validation issues
    results.dependencyValidation.issues.forEach((issue: string) => {
      this.errorReporter.addDependencyError(issue, this.extractFileFromIssue(issue));
    });

    // Configuration validation issues
    results.configValidation.issues.forEach((issue: string) => {
      this.errorReporter.addDeploymentError(issue, this.extractFileFromIssue(issue));
    });

    // Build validation issues
    results.buildValidation.issues.forEach((issue: string) => {
      this.errorReporter.addBuildError(issue, this.extractFileFromIssue(issue));
    });

    // Deployment readiness issues
    results.deploymentReadiness.issues.forEach((issue: string) => {
      this.errorReporter.addDeploymentError(issue, this.extractFileFromIssue(issue));
    });
  }

  /**
   * Extracts file path from issue message
   */
  private extractFileFromIssue(issue: string): string {
    const fileMatch = issue.match(/(?:in |at |from )([^\s:]+\.(?:json|js|ts|tsx))/);
    return fileMatch ? fileMatch[1] : '';
  }

  /**
   * Generates actionable recommendations
   */
  private generateRecommendations(errorSummary: any): string[] {
    const recommendations: string[] = [];

    if (errorSummary.criticalIssues.length > 0) {
      recommendations.push('🔥 Fix critical issues first - these block deployment');
      recommendations.push('📦 Focus on package configuration and dependency issues');
    }

    if (errorSummary.totalErrors > 0) {
      recommendations.push('⚡ Use fast-fail approach - fix errors in order of criticality');
      recommendations.push('🔍 Run validation after each fix to see progress');
    }

    if (errorSummary.totalWarnings > 0) {
      recommendations.push('⚠️  Address warnings to improve deployment reliability');
    }

    if (errorSummary.totalErrors === 0 && errorSummary.totalWarnings === 0) {
      recommendations.push('✅ All validations passed - ready for deployment!');
      recommendations.push('🚀 Consider running a test deployment to staging first');
    }

    return recommendations;
  }

  /**
   * Generates next steps based on validation results
   */
  private generateNextSteps(status: string, errorSummary: any): string[] {
    const nextSteps: string[] = [];

    switch (status) {
      case 'BLOCKED':
        nextSteps.push('1. Review error report above');
        nextSteps.push('2. Fix critical issues first (package config, dependencies)');
        nextSteps.push('3. Re-run validation: npm run deploy:validate');
        nextSteps.push('4. Repeat until all errors are resolved');
        break;

      case 'WARNINGS':
        nextSteps.push('1. Review warnings (optional but recommended)');
        nextSteps.push('2. Deploy to staging: git push origin staging');
        nextSteps.push('3. Test staging deployment thoroughly');
        nextSteps.push('4. Deploy to production: git push origin main');
        break;

      case 'READY':
        nextSteps.push('1. Commit all changes: git add . && git commit -m "deployment fixes"');
        nextSteps.push('2. Push to trigger deployment: git push origin main');
        nextSteps.push('3. Monitor deployment: vercel --logs');
        nextSteps.push('4. Verify deployment: curl $VERCEL_URL/api/health');
        break;
    }

    return nextSteps;
  }

  /**
   * Prints comprehensive deployment report
   */
  private printDeploymentReport(report: DeploymentReport): void {
    console.log('\n🎯 DEPLOYMENT READINESS REPORT');
    console.log('==============================\n');

    // Status indicator
    const statusIcon = {
      'READY': '✅',
      'BLOCKED': '❌',
      'WARNINGS': '⚠️'
    }[report.overallStatus];

    console.log(`${statusIcon} OVERALL STATUS: ${report.overallStatus}`);
    console.log(`📅 Timestamp: ${report.timestamp}\n`);

    // Validation results
    console.log('📊 VALIDATION RESULTS:');
    Object.entries(report.validationResults).forEach(([key, passed]) => {
      const icon = passed ? '✅' : '❌';
      const name = key.replace(/([A-Z])/g, ' $1').toLowerCase();
      console.log(`   ${icon} ${name}: ${passed ? 'PASSED' : 'FAILED'}`);
    });
    console.log();

    // Error summary
    console.log('📈 ERROR SUMMARY:');
    console.log(`   Errors: ${report.errorSummary.totalErrors}`);
    console.log(`   Warnings: ${report.errorSummary.totalWarnings}`);
    console.log(`   Critical Issues: ${report.errorSummary.criticalIssues}\n`);

    // Print detailed error report
    this.errorReporter.printReport();

    // Recommendations
    if (report.recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS:');
      report.recommendations.forEach(rec => console.log(`   ${rec}`));
      console.log();
    }

    // Next steps
    console.log('🚀 NEXT STEPS:');
    report.nextSteps.forEach(step => console.log(`   ${step}`));
    console.log();

    // Footer
    console.log('📖 For more help:');
    console.log('   - Deployment Guide: ./DEPLOYMENT.md');
    console.log('   - Vercel Docs: https://vercel.com/docs');
    console.log('   - Re-run validation: npm run deploy:validate\n');
  }

  /**
   * Saves report to file for CI/CD integration
   */
  private async saveReportToFile(report: DeploymentReport): Promise<void> {
    try {
      const reportPath = 'deployment-validation-report.json';
      const reportContent = {
        ...report,
        detailedErrors: this.errorReporter.getReports()
      };

      fs.writeFileSync(reportPath, JSON.stringify(reportContent, null, 2));
      console.log(`📄 Report saved to: ${reportPath}`);
    } catch (error) {
      console.warn(`⚠️  Could not save report to file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets the error reporter instance
   */
  getErrorReporter(): ErrorReporter {
    return this.errorReporter;
  }
}

// CLI usage
if (require.main === module) {
  const validator = new DeploymentValidator();
  
  validator.validateDeployment()
    .then(report => {
      const exitCode = report.overallStatus === 'BLOCKED' ? 1 : 0;
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('❌ Deployment validation failed:', error);
      process.exit(1);
    });
}