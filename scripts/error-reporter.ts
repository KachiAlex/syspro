#!/usr/bin/env node

/**
 * Error Reporting System for Deployment Validation
 * Implements Requirements 4.2, 4.3
 * Provides clear error message formatting and actionable suggestions
 */

export interface ErrorReport {
  category: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  suggestion?: string;
  documentation?: string;
}

export interface ErrorSummary {
  totalErrors: number;
  totalWarnings: number;
  categories: string[];
  criticalIssues: ErrorReport[];
  hasBlockingErrors: boolean;
}

export class ErrorReporter {
  private reports: ErrorReport[] = [];

  /**
   * Adds an error report
   */
  addError(report: ErrorReport): void {
    this.reports.push(report);
  }

  /**
   * Adds a package configuration error with actionable suggestions
   * Implements Requirements 4.2
   */
  addPackageError(message: string, file: string, suggestion?: string): void {
    this.addError({
      category: 'Package Configuration',
      severity: 'error',
      message,
      file,
      suggestion: suggestion || this.getPackageErrorSuggestion(message),
      documentation: 'https://docs.npmjs.com/cli/v7/configuring-npm/package-json'
    });
  }

  /**
   * Adds a dependency error with resolution guidance
   * Implements Requirements 4.2
   */
  addDependencyError(message: string, file: string, suggestion?: string): void {
    this.addError({
      category: 'Dependencies',
      severity: 'error',
      message,
      file,
      suggestion: suggestion || this.getDependencyErrorSuggestion(message),
      documentation: 'https://docs.npmjs.com/cli/v7/commands/npm-install'
    });
  }

  /**
   * Adds a build configuration error
   * Implements Requirements 4.2
   */
  addBuildError(message: string, file?: string, suggestion?: string): void {
    this.addError({
      category: 'Build Configuration',
      severity: 'error',
      message,
      file,
      suggestion: suggestion || this.getBuildErrorSuggestion(message),
      documentation: 'https://nextjs.org/docs/app/api-reference/next-config-js'
    });
  }

  /**
   * Adds a deployment configuration error
   * Implements Requirements 4.2
   */
  addDeploymentError(message: string, file?: string, suggestion?: string): void {
    this.addError({
      category: 'Deployment',
      severity: 'error',
      message,
      file,
      suggestion: suggestion || this.getDeploymentErrorSuggestion(message),
      documentation: 'https://vercel.com/docs/concepts/projects/project-configuration'
    });
  }

  /**
   * Adds a warning (non-blocking issue)
   */
  addWarning(message: string, category: string, file?: string, suggestion?: string): void {
    this.addError({
      category,
      severity: 'warning',
      message,
      file,
      suggestion,
    });
  }

  /**
   * Gets actionable suggestions for package errors
   */
  private getPackageErrorSuggestion(message: string): string {
    if (message.includes('duplicate')) {
      return 'Remove the duplicate section from package.json. Keep only one "dependencies" and one "devDependencies" section.';
    }
    if (message.includes('Missing name')) {
      return 'Add a "name" field to package.json with a valid package name (e.g., "@syspro/web").';
    }
    if (message.includes('Missing version')) {
      return 'Add a "version" field to package.json (e.g., "1.0.0").';
    }
    if (message.includes('Missing build script')) {
      return 'Add a "build" script to the "scripts" section in package.json.';
    }
    if (message.includes('Failed to parse')) {
      return 'Fix the JSON syntax error in package.json. Check for missing commas, brackets, or quotes.';
    }
    return 'Review and fix the package.json configuration.';
  }

  /**
   * Gets actionable suggestions for dependency errors
   */
  private getDependencyErrorSuggestion(message: string): string {
    if (message.includes('Missing TypeScript dependencies')) {
      return 'Run: npm install --save-dev typescript @types/node @types/react';
    }
    if (message.includes('Workspace dependency') && message.includes('not found')) {
      return 'Ensure the workspace package exists or remove the dependency from package.json.';
    }
    if (message.includes('@next/eslint-config-next')) {
      return 'Replace "@next/eslint-config-next" with "eslint-config-next" in package.json.';
    }
    if (message.includes('version conflict')) {
      return 'Resolve version conflicts by updating to compatible versions or using resolutions.';
    }
    return 'Review and fix dependency configuration.';
  }

  /**
   * Gets actionable suggestions for build errors
   */
  private getBuildErrorSuggestion(message: string): string {
    if (message.includes('TypeScript compiler not accessible')) {
      return 'Install TypeScript: npm install --save-dev typescript';
    }
    if (message.includes('Missing critical build file')) {
      return 'Ensure all required build files exist. Check the project structure.';
    }
    if (message.includes('Missing React import')) {
      return 'Add "import React from \'react\';" to the top of the file.';
    }
    if (message.includes('tsconfig')) {
      return 'Fix the TypeScript configuration file syntax and ensure all required options are set.';
    }
    return 'Review and fix build configuration.';
  }

  /**
   * Gets actionable suggestions for deployment errors
   */
  private getDeploymentErrorSuggestion(message: string): string {
    if (message.includes('Vercel configuration missing builds')) {
      return 'Add a "builds" section to vercel.json with appropriate build configuration.';
    }
    if (message.includes('No deployment build script')) {
      return 'Add a "vercel-build" or "build:vercel" script to the root package.json.';
    }
    if (message.includes('No environment configuration')) {
      return 'Create .env.example or .env.production.template files with required environment variables.';
    }
    if (message.includes('deployment blocker') && message.includes('not gitignored')) {
      return 'Add the file/directory to .gitignore to prevent it from being committed.';
    }
    return 'Review and fix deployment configuration.';
  }

  /**
   * Generates error summary
   * Implements Requirements 4.3
   */
  getErrorSummary(): ErrorSummary {
    const errors = this.reports.filter(r => r.severity === 'error');
    const warnings = this.reports.filter(r => r.severity === 'warning');
    const categories = [...new Set(this.reports.map(r => r.category))];
    
    // Critical issues are errors that block deployment
    const criticalIssues = errors.filter(error => 
      error.category === 'Package Configuration' ||
      error.category === 'Dependencies' ||
      (error.category === 'Build Configuration' && error.message.includes('TypeScript'))
    );

    return {
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      categories,
      criticalIssues,
      hasBlockingErrors: errors.length > 0
    };
  }

  /**
   * Prints formatted error report
   * Implements Requirements 4.2, 4.3
   */
  printReport(): void {
    const summary = this.getErrorSummary();

    console.log('\n🚨 DEPLOYMENT VALIDATION REPORT');
    console.log('===============================\n');

    if (this.reports.length === 0) {
      console.log('✅ No issues found! Ready for deployment.\n');
      return;
    }

    // Print summary
    console.log('📊 SUMMARY:');
    console.log(`   Errors: ${summary.totalErrors}`);
    console.log(`   Warnings: ${summary.totalWarnings}`);
    console.log(`   Categories: ${summary.categories.join(', ')}`);
    console.log(`   Status: ${summary.hasBlockingErrors ? '❌ BLOCKED' : '⚠️  WARNINGS ONLY'}\n`);

    // Group reports by category
    const reportsByCategory = this.groupReportsByCategory();

    // Print each category
    for (const [category, reports] of Object.entries(reportsByCategory)) {
      console.log(`${this.getCategoryIcon(category)} ${category.toUpperCase()}:`);
      
      for (const report of reports) {
        const icon = report.severity === 'error' ? '❌' : '⚠️';
        console.log(`   ${icon} ${report.message}`);
        
        if (report.file) {
          console.log(`      📁 File: ${report.file}`);
        }
        
        if (report.suggestion) {
          console.log(`      💡 Fix: ${report.suggestion}`);
        }
        
        if (report.documentation) {
          console.log(`      📖 Docs: ${report.documentation}`);
        }
        
        console.log();
      }
    }

    // Print fast-fail recommendations
    if (summary.hasBlockingErrors) {
      console.log('🚀 FAST-FAIL RECOMMENDATIONS:');
      console.log('=============================');
      
      if (summary.criticalIssues.length > 0) {
        console.log('Fix these critical issues first:');
        summary.criticalIssues.forEach((issue, index) => {
          console.log(`${index + 1}. ${issue.message}`);
          if (issue.suggestion) {
            console.log(`   → ${issue.suggestion}`);
          }
        });
      }
      
      console.log('\nAfter fixing critical issues, run the validation again.');
      console.log('Command: node scripts/pre-deployment-checker.js\n');
    }
  }

  /**
   * Groups reports by category
   */
  private groupReportsByCategory(): Record<string, ErrorReport[]> {
    const grouped: Record<string, ErrorReport[]> = {};
    
    for (const report of this.reports) {
      if (!grouped[report.category]) {
        grouped[report.category] = [];
      }
      grouped[report.category].push(report);
    }
    
    return grouped;
  }

  /**
   * Gets icon for category
   */
  private getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      'Package Configuration': '📦',
      'Dependencies': '🔗',
      'Build Configuration': '🏗️',
      'Deployment': '🚀',
      'TypeScript': '📘',
      'Configuration Files': '⚙️'
    };
    
    return icons[category] || '📋';
  }

  /**
   * Exports report as JSON for programmatic use
   */
  exportJson(): string {
    return JSON.stringify({
      summary: this.getErrorSummary(),
      reports: this.reports,
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Clears all reports
   */
  clear(): void {
    this.reports = [];
  }

  /**
   * Gets all reports
   */
  getReports(): ErrorReport[] {
    return [...this.reports];
  }

  /**
   * Checks if there are any blocking errors
   * Implements Requirements 4.3 (fast-fail mechanism)
   */
  hasBlockingErrors(): boolean {
    return this.reports.some(r => r.severity === 'error');
  }
}

// CLI usage for testing
if (require.main === module) {
  const reporter = new ErrorReporter();
  
  // Example usage
  reporter.addPackageError('Duplicate dependency sections found', 'apps/web/package.json');
  reporter.addDependencyError('Missing TypeScript dependencies: typescript, @types/node', 'apps/web/package.json');
  reporter.addBuildError('TypeScript compiler not accessible');
  reporter.addWarning('Build output directory is empty', 'Build Configuration', 'apps/web/dist');
  
  reporter.printReport();
  
  console.log('\nJSON Export:');
  console.log(reporter.exportJson());
}