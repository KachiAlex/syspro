/**
 * Property Tests for Deployment Validation
 * Feature: deployment-fixes
 * Property 12: Comprehensive Configuration Validation
 * Validates: Requirements 4.4
 */

import { PreDeploymentChecker } from '../pre-deployment-checker';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs for testing
jest.mock('fs');
jest.mock('child_process');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('Property 12: Comprehensive Configuration Validation', () => {
  let checker: PreDeploymentChecker;

  beforeEach(() => {
    checker = new PreDeploymentChecker();
    jest.clearAllMocks();
  });

  /**
   * Property: For any configuration validation run, the validation process 
   * should check for all known common deployment issues and report them clearly.
   */
  describe('Comprehensive validation coverage', () => {
    test('should validate all critical configuration aspects', () => {
      // Arrange: Mock a complete valid configuration
      const validPackageJson = JSON.stringify({
        name: '@syspro/web',
        version: '1.0.0',
        scripts: { build: 'next build' },
        dependencies: { react: '^18.0.0' },
        devDependencies: { 
          typescript: '^5.0.0',
          '@types/node': '^20.0.0',
          '@types/react': '^18.0.0'
        }
      });

      const validVercelConfig = JSON.stringify({
        builds: [{ src: 'apps/web/package.json', use: '@vercel/next' }]
      });

      const validTsConfig = JSON.stringify({
        compilerOptions: { target: 'ES2022' }
      });

      const validTurboConfig = JSON.stringify({
        pipeline: { build: {} }
      });

      mockFs.existsSync.mockImplementation((filePath: string) => {
        const pathStr = filePath.toString();
        return pathStr.includes('package.json') || 
               pathStr.includes('vercel.json') ||
               pathStr.includes('tsconfig.json') ||
               pathStr.includes('turbo.json') ||
               pathStr.includes('.env.example');
      });

      mockFs.readFileSync.mockImplementation((filePath: string) => {
        const pathStr = filePath.toString();
        if (pathStr.includes('package.json')) return validPackageJson;
        if (pathStr.includes('vercel.json')) return validVercelConfig;
        if (pathStr.includes('tsconfig.json')) return validTsConfig;
        if (pathStr.includes('turbo.json')) return validTurboConfig;
        return '';
      });

      // Act
      const result = checker.runPreDeploymentCheck();

      // Assert: Should validate all aspects
      expect(result).toBe(true);
      const results = checker.getResults();
      
      // Verify all validation categories are checked
      expect(results.packageValidation).toBeDefined();
      expect(results.dependencyValidation).toBeDefined();
      expect(results.configValidation).toBeDefined();
      expect(results.buildValidation).toBeDefined();
      expect(results.deploymentReadiness).toBeDefined();
    });

    test('should detect and report duplicate dependency sections', () => {
      // Arrange: Package with duplicate dependencies
      const duplicatePackageJson = `{
        "name": "@syspro/web",
        "version": "1.0.0",
        "dependencies": {
          "react": "^18.0.0"
        },
        "dependencies": {
          "next": "^14.0.0"
        }
      }`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(duplicatePackageJson);

      // Act
      const result = checker.runPreDeploymentCheck();

      // Assert: Should detect duplicate sections
      expect(result).toBe(false);
      const results = checker.getResults();
      expect(results.packageValidation.passed).toBe(false);
      expect(results.packageValidation.issues).toContain(
        expect.stringContaining('Duplicate dependency sections')
      );
    });

    test('should detect missing TypeScript dependencies', () => {
      // Arrange: Web package missing TypeScript deps
      const incompletePackageJson = JSON.stringify({
        name: '@syspro/web',
        version: '1.0.0',
        scripts: { build: 'next build' },
        dependencies: { react: '^18.0.0' },
        devDependencies: {} // Missing TypeScript deps
      });

      mockFs.existsSync.mockImplementation((filePath: string) => {
        return filePath.toString().includes('apps/web/package.json');
      });

      mockFs.readFileSync.mockReturnValue(incompletePackageJson);

      // Act
      const result = checker.runPreDeploymentCheck();

      // Assert: Should detect missing TypeScript dependencies
      expect(result).toBe(false);
      const results = checker.getResults();
      expect(results.dependencyValidation.passed).toBe(false);
      expect(results.dependencyValidation.issues).toContain(
        expect.stringContaining('Missing TypeScript dependencies')
      );
    });

    test('should validate Vercel configuration completeness', () => {
      // Arrange: Invalid Vercel config
      const invalidVercelConfig = JSON.stringify({
        // Missing builds section
        routes: []
      });

      mockFs.existsSync.mockImplementation((filePath: string) => {
        return filePath.toString().includes('vercel.json');
      });

      mockFs.readFileSync.mockReturnValue(invalidVercelConfig);

      // Act
      const result = checker.runPreDeploymentCheck();

      // Assert: Should detect missing builds configuration
      expect(result).toBe(false);
      const results = checker.getResults();
      expect(results.configValidation.passed).toBe(false);
      expect(results.configValidation.issues).toContain(
        expect.stringContaining('missing builds section')
      );
    });

    test('should validate workspace dependency existence', () => {
      // Arrange: Package with non-existent workspace dependency
      const packageWithWorkspaceDep = JSON.stringify({
        name: '@syspro/web',
        version: '1.0.0',
        scripts: { build: 'next build' },
        dependencies: {
          '@syspro/nonexistent': 'workspace:*'
        },
        devDependencies: {
          typescript: '^5.0.0',
          '@types/node': '^20.0.0',
          '@types/react': '^18.0.0'
        }
      });

      mockFs.existsSync.mockImplementation((filePath: string) => {
        const pathStr = filePath.toString();
        if (pathStr.includes('apps/web/package.json')) return true;
        if (pathStr.includes('libs/nonexistent/package.json')) return false;
        return false;
      });

      mockFs.readFileSync.mockReturnValue(packageWithWorkspaceDep);

      // Act
      const result = checker.runPreDeploymentCheck();

      // Assert: Should detect missing workspace dependency
      expect(result).toBe(false);
      const results = checker.getResults();
      expect(results.dependencyValidation.passed).toBe(false);
      expect(results.dependencyValidation.issues).toContain(
        expect.stringContaining('Workspace dependency @syspro/nonexistent not found')
      );
    });
  });

  /**
   * Property: Validation should provide clear, actionable error messages
   */
  describe('Clear error reporting', () => {
    test('should provide specific file paths in error messages', () => {
      // Arrange: Missing package.json
      mockFs.existsSync.mockReturnValue(false);

      // Act
      const result = checker.runPreDeploymentCheck();

      // Assert: Error messages should include file paths
      expect(result).toBe(false);
      const results = checker.getResults();
      expect(results.packageValidation.issues.some(issue => 
        issue.includes('package.json') && issue.includes('Missing')
      )).toBe(true);
    });

    test('should categorize issues by validation type', () => {
      // Arrange: Multiple types of issues
      const invalidJson = 'invalid json content';
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(invalidJson);

      // Act
      const result = checker.runPreDeploymentCheck();

      // Assert: Issues should be categorized
      expect(result).toBe(false);
      const results = checker.getResults();
      
      // Each validation category should have its own issues array
      expect(Array.isArray(results.packageValidation.issues)).toBe(true);
      expect(Array.isArray(results.dependencyValidation.issues)).toBe(true);
      expect(Array.isArray(results.configValidation.issues)).toBe(true);
    });
  });

  /**
   * Property: Validation should be deterministic and consistent
   */
  describe('Deterministic validation', () => {
    test('should produce consistent results for identical configurations', () => {
      // Arrange: Same configuration
      const packageJson = JSON.stringify({
        name: '@syspro/web',
        version: '1.0.0',
        scripts: { build: 'next build' }
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(packageJson);

      // Act: Run validation multiple times
      const result1 = checker.runPreDeploymentCheck();
      const results1 = checker.getResults();
      
      const checker2 = new PreDeploymentChecker();
      const result2 = checker2.runPreDeploymentCheck();
      const results2 = checker2.getResults();

      // Assert: Results should be identical
      expect(result1).toBe(result2);
      expect(results1.packageValidation.passed).toBe(results2.packageValidation.passed);
      expect(results1.packageValidation.issues.length).toBe(results2.packageValidation.issues.length);
    });
  });

  /**
   * Property: Validation should handle edge cases gracefully
   */
  describe('Edge case handling', () => {
    test('should handle malformed JSON gracefully', () => {
      // Arrange: Malformed JSON
      const malformedJson = '{ "name": "@syspro/web", "version": ';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(malformedJson);

      // Act & Assert: Should not throw, should report error
      expect(() => checker.runPreDeploymentCheck()).not.toThrow();
      
      const results = checker.getResults();
      expect(results.packageValidation.passed).toBe(false);
      expect(results.packageValidation.issues.some(issue => 
        issue.includes('Failed to parse')
      )).toBe(true);
    });

    test('should handle missing files gracefully', () => {
      // Arrange: No files exist
      mockFs.existsSync.mockReturnValue(false);

      // Act & Assert: Should not throw
      expect(() => checker.runPreDeploymentCheck()).not.toThrow();
      
      const results = checker.getResults();
      expect(results.overallStatus).toBe(false);
    });

    test('should handle empty configuration files', () => {
      // Arrange: Empty files
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{}');

      // Act & Assert: Should handle empty configs
      expect(() => checker.runPreDeploymentCheck()).not.toThrow();
      
      const results = checker.getResults();
      // Should detect missing required fields
      expect(results.packageValidation.passed).toBe(false);
    });
  });
});