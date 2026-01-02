/**
 * Property Tests for Error Handling
 * Feature: deployment-fixes
 * Property 11: Fast Failure on Missing Dependencies
 * Validates: Requirements 4.3
 */

import { ErrorReporter, ErrorReport } from '../error-reporter';

describe('Property 11: Fast Failure on Missing Dependencies', () => {
  let reporter: ErrorReporter;

  beforeEach(() => {
    reporter = new ErrorReporter();
  });

  /**
   * Property: For any build attempt with missing critical dependencies, 
   * the build system should fail quickly with a clear error message 
   * identifying the missing dependencies.
   */
  describe('Fast failure mechanism', () => {
    test('should immediately identify blocking errors', () => {
      // Arrange: Add critical dependency error
      reporter.addDependencyError(
        'Missing TypeScript dependencies: typescript, @types/node',
        'apps/web/package.json'
      );
      
      // Act & Assert: Should immediately identify as blocking
      expect(reporter.hasBlockingErrors()).toBe(true);
      
      const summary = reporter.getErrorSummary();
      expect(summary.hasBlockingErrors).toBe(true);
      expect(summary.criticalIssues.length).toBeGreaterThan(0);
    });

    test('should distinguish between blocking and non-blocking issues', () => {
      // Arrange: Add warning (non-blocking)
      reporter.addWarning(
        'Build output directory is empty',
        'Build Configuration',
        'apps/web/dist'
      );
      
      // Act & Assert: Should not be blocking
      expect(reporter.hasBlockingErrors()).toBe(false);
      
      const summary = reporter.getErrorSummary();
      expect(summary.hasBlockingErrors).toBe(false);
      expect(summary.totalWarnings).toBe(1);
      expect(summary.totalErrors).toBe(0);
    });

    test('should prioritize critical issues in fast-fail recommendations', () => {
      // Arrange: Add multiple issues with different criticality
      reporter.addPackageError(
        'Duplicate dependency sections found',
        'apps/web/package.json'
      );
      reporter.addDependencyError(
        'Missing TypeScript dependencies: typescript',
        'apps/web/package.json'
      );
      reporter.addBuildError(
        'Missing critical build file: next.config.js'
      );
      
      // Act
      const summary = reporter.getErrorSummary();
      
      // Assert: Critical issues should be identified
      expect(summary.criticalIssues.length).toBeGreaterThan(0);
      expect(summary.criticalIssues.some(issue => 
        issue.category === 'Package Configuration' ||
        issue.category === 'Dependencies'
      )).toBe(true);
    });
  });

  /**
   * Property: Error messages should be clear and actionable
   */
  describe('Clear error messaging', () => {
    test('should provide specific file paths in error messages', () => {
      // Arrange & Act
      reporter.addPackageError(
        'Missing name field',
        'apps/web/package.json'
      );
      
      // Assert
      const reports = reporter.getReports();
      expect(reports[0].file).toBe('apps/web/package.json');
      expect(reports[0].message).toContain('Missing name field');
    });

    test('should provide actionable suggestions for common errors', () => {
      // Arrange & Act: Add various error types
      reporter.addPackageError(
        'Duplicate dependency sections found',
        'apps/web/package.json'
      );
      reporter.addDependencyError(
        'Missing TypeScript dependencies: typescript, @types/node',
        'apps/web/package.json'
      );
      
      // Assert: All errors should have suggestions
      const reports = reporter.getReports();
      reports.forEach(report => {
        expect(report.suggestion).toBeDefined();
        expect(report.suggestion).not.toBe('');
      });
      
      // Check specific suggestions
      const duplicateError = reports.find(r => r.message.includes('Duplicate'));
      expect(duplicateError?.suggestion).toContain('Remove the duplicate section');
      
      const tsError = reports.find(r => r.message.includes('TypeScript dependencies'));
      expect(tsError?.suggestion).toContain('npm install --save-dev');
    });

    test('should categorize errors appropriately', () => {
      // Arrange & Act: Add errors of different categories
      reporter.addPackageError('Package error', 'package.json');
      reporter.addDependencyError('Dependency error', 'package.json');
      reporter.addBuildError('Build error');
      reporter.addDeploymentError('Deployment error');
      
      // Assert: Should have different categories
      const summary = reporter.getErrorSummary();
      expect(summary.categories).toContain('Package Configuration');
      expect(summary.categories).toContain('Dependencies');
      expect(summary.categories).toContain('Build Configuration');
      expect(summary.categories).toContain('Deployment');
    });

    test('should include documentation links for guidance', () => {
      // Arrange & Act
      reporter.addPackageError('Package error', 'package.json');
      reporter.addDependencyError('Dependency error', 'package.json');
      
      // Assert: Should include documentation
      const reports = reporter.getReports();
      reports.forEach(report => {
        expect(report.documentation).toBeDefined();
        expect(report.documentation).toMatch(/^https?:\/\//);
      });
    });
  });

  /**
   * Property: Error reporting should be consistent and deterministic
   */
  describe('Consistent error reporting', () => {
    test('should produce consistent error categorization', () => {
      // Arrange: Same error added multiple times
      const errorMessage = 'Missing TypeScript dependencies: typescript';
      const fileName = 'apps/web/package.json';
      
      // Act: Add same error to different reporters
      const reporter1 = new ErrorReporter();
      const reporter2 = new ErrorReporter();
      
      reporter1.addDependencyError(errorMessage, fileName);
      reporter2.addDependencyError(errorMessage, fileName);
      
      // Assert: Should produce identical results
      const reports1 = reporter1.getReports();
      const reports2 = reporter2.getReports();
      
      expect(reports1[0].category).toBe(reports2[0].category);
      expect(reports1[0].severity).toBe(reports2[0].severity);
      expect(reports1[0].message).toBe(reports2[0].message);
    });

    test('should maintain error order and grouping', () => {
      // Arrange: Add errors in specific order
      reporter.addPackageError('Package error 1', 'file1.json');
      reporter.addDependencyError('Dependency error 1', 'file2.json');
      reporter.addPackageError('Package error 2', 'file3.json');
      
      // Act
      const reports = reporter.getReports();
      
      // Assert: Should maintain order
      expect(reports[0].message).toBe('Package error 1');
      expect(reports[1].message).toBe('Dependency error 1');
      expect(reports[2].message).toBe('Package error 2');
    });
  });

  /**
   * Property: Error handling should be robust against edge cases
   */
  describe('Edge case handling', () => {
    test('should handle empty error messages gracefully', () => {
      // Arrange & Act: Add error with empty message
      reporter.addPackageError('', 'package.json');
      
      // Assert: Should not crash and should still provide suggestion
      expect(() => reporter.getErrorSummary()).not.toThrow();
      expect(() => reporter.printReport()).not.toThrow();
      
      const reports = reporter.getReports();
      expect(reports[0].suggestion).toBeDefined();
    });

    test('should handle missing file paths gracefully', () => {
      // Arrange & Act: Add error without file path
      reporter.addBuildError('Build error without file');
      
      // Assert: Should not crash
      expect(() => reporter.getErrorSummary()).not.toThrow();
      expect(() => reporter.printReport()).not.toThrow();
      
      const reports = reporter.getReports();
      expect(reports[0].file).toBeUndefined();
    });

    test('should handle large numbers of errors efficiently', () => {
      // Arrange: Add many errors
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        reporter.addPackageError(`Error ${i}`, `file${i}.json`);
      }
      
      // Act
      const summary = reporter.getErrorSummary();
      const endTime = Date.now();
      
      // Assert: Should handle efficiently (under 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
      expect(summary.totalErrors).toBe(1000);
    });

    test('should export valid JSON even with special characters', () => {
      // Arrange: Add error with special characters
      reporter.addPackageError(
        'Error with "quotes" and \n newlines and \t tabs',
        'file with spaces.json'
      );
      
      // Act & Assert: Should produce valid JSON
      expect(() => {
        const json = reporter.exportJson();
        JSON.parse(json); // Should not throw
      }).not.toThrow();
    });
  });

  /**
   * Property: Fast-fail should provide clear next steps
   */
  describe('Fast-fail guidance', () => {
    test('should provide clear next steps for critical errors', () => {
      // Arrange: Add critical errors
      reporter.addPackageError(
        'Duplicate dependency sections found',
        'apps/web/package.json'
      );
      reporter.addDependencyError(
        'Missing TypeScript dependencies: typescript',
        'apps/web/package.json'
      );
      
      // Act
      const summary = reporter.getErrorSummary();
      
      // Assert: Should identify as critical and provide guidance
      expect(summary.hasBlockingErrors).toBe(true);
      expect(summary.criticalIssues.length).toBeGreaterThan(0);
      
      // All critical issues should have suggestions
      summary.criticalIssues.forEach(issue => {
        expect(issue.suggestion).toBeDefined();
        expect(issue.suggestion).not.toBe('');
      });
    });

    test('should distinguish between immediate fixes and optional improvements', () => {
      // Arrange: Mix of errors and warnings
      reporter.addPackageError('Critical package error', 'package.json');
      reporter.addWarning('Optional improvement', 'Build Configuration');
      
      // Act
      const summary = reporter.getErrorSummary();
      
      // Assert: Should separate critical from optional
      expect(summary.hasBlockingErrors).toBe(true);
      expect(summary.totalErrors).toBe(1);
      expect(summary.totalWarnings).toBe(1);
      expect(summary.criticalIssues.length).toBe(1);
    });
  });
});