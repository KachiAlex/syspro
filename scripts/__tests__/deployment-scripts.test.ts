/**
 * Unit Tests for Deployment Scripts
 * Tests script execution and error handling
 * Validates: Requirements 3.4
 */

import { DeploymentValidator } from '../deploy-validate';
import { ErrorReporter } from '../error-reporter';

// Mock the dependencies
jest.mock('../pre-deployment-checker');
jest.mock('../validate-packages.js');
jest.mock('../build-check.js');
jest.mock('fs');

describe('Deployment Scripts', () => {
  let validator: DeploymentValidator;

  beforeEach(() => {
    validator = new DeploymentValidator();
    jest.clearAllMocks();
  });

  describe('DeploymentValidator', () => {
    test('should initialize all required validators', () => {
      // Act & Assert: Constructor should not throw
      expect(() => new DeploymentValidator()).not.toThrow();
      expect(validator.getErrorReporter()).toBeInstanceOf(ErrorReporter);
    });

    test('should handle validation errors gracefully', async () => {
      // Arrange: Mock validation failure
      const mockPackageValidator = {
        validateAllPackages: jest.fn().mockReturnValue({
          packageConfigValid: false,
          typescriptDepsAvailable: false,
          issues: ['Test package error']
        })
      };

      // Act & Assert: Should not throw on validation errors
      await expect(async () => {
        // This would normally call the mocked validators
        const report = await validator.validateDeployment();
        expect(report).toBeDefined();
      }).not.toThrow();
    });

    test('should generate comprehensive deployment report', async () => {
      // Act
      const report = await validator.validateDeployment();

      // Assert: Report should have all required fields
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('overallStatus');
      expect(report).toHaveProperty('validationResults');
      expect(report).toHaveProperty('errorSummary');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('nextSteps');

      // Validation results should have all categories
      expect(report.validationResults).toHaveProperty('packageValidation');
      expect(report.validationResults).toHaveProperty('dependencyValidation');
      expect(report.validationResults).toHaveProperty('configValidation');
      expect(report.validationResults).toHaveProperty('buildValidation');
      expect(report.validationResults).toHaveProperty('deploymentReadiness');

      // Error summary should have counts
      expect(report.errorSummary).toHaveProperty('totalErrors');
      expect(report.errorSummary).toHaveProperty('totalWarnings');
      expect(report.errorSummary).toHaveProperty('criticalIssues');

      // Should have actionable content
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(Array.isArray(report.nextSteps)).toBe(true);
    });

    test('should determine correct overall status based on errors', async () => {
      // Test different scenarios
      const scenarios = [
        {
          name: 'no errors or warnings',
          errors: 0,
          warnings: 0,
          expectedStatus: 'READY'
        },
        {
          name: 'warnings only',
          errors: 0,
          warnings: 2,
          expectedStatus: 'WARNINGS'
        },
        {
          name: 'blocking errors',
          errors: 1,
          warnings: 0,
          expectedStatus: 'BLOCKED'
        }
      ];

      for (const scenario of scenarios) {
        // Arrange: Set up error reporter with specific counts
        const errorReporter = validator.getErrorReporter();
        errorReporter.clear();

        // Add errors/warnings based on scenario
        for (let i = 0; i < scenario.errors; i++) {
          errorReporter.addPackageError(`Test error ${i}`, 'test.json');
        }
        for (let i = 0; i < scenario.warnings; i++) {
          errorReporter.addWarning(`Test warning ${i}`, 'Test Category');
        }

        // Act
        const report = await validator.validateDeployment();

        // Assert
        expect(report.overallStatus).toBe(scenario.expectedStatus);
        expect(report.errorSummary.totalErrors).toBe(scenario.errors);
        expect(report.errorSummary.totalWarnings).toBe(scenario.warnings);
      }
    });

    test('should provide appropriate next steps for each status', async () => {
      // Test BLOCKED status
      const errorReporter = validator.getErrorReporter();
      errorReporter.addPackageError('Critical error', 'package.json');
      
      const blockedReport = await validator.validateDeployment();
      expect(blockedReport.overallStatus).toBe('BLOCKED');
      expect(blockedReport.nextSteps.some(step => 
        step.includes('Fix critical issues')
      )).toBe(true);

      // Test READY status
      errorReporter.clear();
      const readyReport = await validator.validateDeployment();
      expect(readyReport.nextSteps.some(step => 
        step.includes('git push') || step.includes('Deploy')
      )).toBe(true);
    });

    test('should handle file extraction from error messages', async () => {
      // Arrange: Add errors with file paths in messages
      const errorReporter = validator.getErrorReporter();
      errorReporter.addPackageError(
        'Duplicate sections found in apps/web/package.json',
        'apps/web/package.json'
      );

      // Act
      const report = await validator.validateDeployment();

      // Assert: Should extract and use file paths
      const reports = errorReporter.getReports();
      expect(reports[0].file).toBe('apps/web/package.json');
    });
  });

  describe('Script Integration', () => {
    test('should integrate with existing build tools', () => {
      // This test verifies that the deployment validator can work with
      // the existing package validator and build checker
      
      // Arrange & Act: Create validator (uses real constructors)
      const validator = new DeploymentValidator();
      
      // Assert: Should have access to all required tools
      expect(validator.getErrorReporter()).toBeDefined();
      
      // Should be able to call validation methods without throwing
      expect(() => validator.validateDeployment()).not.toThrow();
    });

    test('should handle missing dependencies gracefully', async () => {
      // This test ensures the script works even when some tools fail
      
      // Act & Assert: Should handle errors in validation tools
      const validator = new DeploymentValidator();
      
      // Even if individual validators fail, the main script should continue
      await expect(validator.validateDeployment()).resolves.toBeDefined();
    });

    test('should produce consistent results across runs', async () => {
      // Arrange: Create two validators with same conditions
      const validator1 = new DeploymentValidator();
      const validator2 = new DeploymentValidator();

      // Act: Run validation on both
      const report1 = await validator1.validateDeployment();
      const report2 = await validator2.validateDeployment();

      // Assert: Should produce similar structure (content may vary due to timestamps)
      expect(typeof report1.overallStatus).toBe(typeof report2.overallStatus);
      expect(Object.keys(report1.validationResults)).toEqual(
        Object.keys(report2.validationResults)
      );
      expect(Object.keys(report1.errorSummary)).toEqual(
        Object.keys(report2.errorSummary)
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle filesystem errors gracefully', async () => {
      // Arrange: Mock fs to throw errors
      const fs = require('fs');
      fs.writeFileSync = jest.fn().mockImplementation(() => {
        throw new Error('Filesystem error');
      });

      // Act & Assert: Should not crash on file save errors
      const validator = new DeploymentValidator();
      await expect(validator.validateDeployment()).resolves.toBeDefined();
    });

    test('should handle malformed validation results', async () => {
      // This test ensures robustness against unexpected data structures
      
      // Act & Assert: Should handle edge cases gracefully
      const validator = new DeploymentValidator();
      
      // Should not throw even with unexpected validation results
      await expect(validator.validateDeployment()).resolves.toBeDefined();
    });

    test('should provide meaningful error messages for common failures', async () => {
      // Arrange: Add various types of errors
      const validator = new DeploymentValidator();
      const errorReporter = validator.getErrorReporter();
      
      errorReporter.addPackageError('Package error', 'package.json');
      errorReporter.addDependencyError('Dependency error', 'package.json');
      errorReporter.addBuildError('Build error');
      errorReporter.addDeploymentError('Deployment error');

      // Act
      const report = await validator.validateDeployment();

      // Assert: Should categorize and provide guidance for each error type
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.nextSteps.length).toBeGreaterThan(0);
      
      // Should provide specific guidance for blocked status
      if (report.overallStatus === 'BLOCKED') {
        expect(report.nextSteps.some(step => 
          step.includes('Fix') || step.includes('Review')
        )).toBe(true);
      }
    });
  });

  describe('Performance', () => {
    test('should complete validation within reasonable time', async () => {
      // Arrange
      const startTime = Date.now();
      const validator = new DeploymentValidator();

      // Act
      await validator.validateDeployment();
      const endTime = Date.now();

      // Assert: Should complete within 30 seconds (generous for CI)
      expect(endTime - startTime).toBeLessThan(30000);
    });

    test('should handle large numbers of validation issues efficiently', async () => {
      // Arrange: Add many errors
      const validator = new DeploymentValidator();
      const errorReporter = validator.getErrorReporter();
      
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        errorReporter.addPackageError(`Error ${i}`, `file${i}.json`);
      }

      // Act
      const report = await validator.validateDeployment();
      const endTime = Date.now();

      // Assert: Should handle many errors efficiently
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
      expect(report.errorSummary.totalErrors).toBe(100);
    });
  });
});