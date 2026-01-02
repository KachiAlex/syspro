import * as fs from 'fs';
import * as path from 'path';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { PackageValidator } from '../package-validator';

/**
 * Property-Based Tests for Package Validator
 * Feature: deployment-fixes, Property 1: Package Manager Dependency Resolution
 * Validates: Requirements 1.1
 */

describe('Package Validator Property Tests', () => {
  let validator: PackageValidator;
  let tempDir: string;

  beforeEach(() => {
    validator = new PackageValidator();
    tempDir = fs.mkdtempSync(path.join(__dirname, 'temp-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Property 1: Package Manager Dependency Resolution
   * For any valid package.json file without duplicate sections, 
   * the package manager should successfully resolve all dependencies without conflicts
   */
  test('Property 1: Package Manager Dependency Resolution - valid package.json files should pass validation', () => {
    // Generate various valid package.json configurations
    const validConfigs = [
      {
        name: 'test-package-1',
        version: '1.0.0',
        dependencies: {
          'react': '^18.0.0',
          'typescript': '^5.0.0'
        },
        devDependencies: {
          '@types/node': '^20.0.0'
        }
      },
      {
        name: 'test-package-2',
        version: '2.1.0',
        dependencies: {
          'next': '^14.0.0'
        },
        devDependencies: {
          'jest': '^29.0.0',
          '@types/react': '^18.0.0'
        }
      },
      {
        name: 'test-package-3',
        version: '0.1.0',
        dependencies: {},
        devDependencies: {
          'typescript': '^5.3.2',
          '@types/node': '^20.9.0'
        }
      }
    ];

    validConfigs.forEach((config, index) => {
      const packagePath = path.join(tempDir, `package-${index}.json`);
      fs.writeFileSync(packagePath, JSON.stringify(config, null, 2));
      
      const isValid = validator.validatePackageStructure(packagePath);
      expect(isValid).toBe(true);
      expect(validator.getIssues()).toHaveLength(0);
      
      validator.clearIssues();
    });
  });

  /**
   * Property 2: Duplicate Section Detection
   * For any package.json file containing duplicate dependency sections,
   * the build system should fail with a clear error message
   */
  test('Property 2: Duplicate Section Detection - package.json with duplicate sections should fail validation', () => {
    const duplicateConfigs = [
      // Duplicate dependencies sections
      `{
        "name": "test-package",
        "version": "1.0.0",
        "dependencies": {
          "react": "^18.0.0"
        },
        "devDependencies": {
          "@types/node": "^20.0.0"
        },
        "dependencies": {
          "typescript": "^5.0.0"
        }
      }`,
      // Duplicate devDependencies sections
      `{
        "name": "test-package",
        "version": "1.0.0",
        "dependencies": {
          "react": "^18.0.0"
        },
        "devDependencies": {
          "@types/node": "^20.0.0"
        },
        "devDependencies": {
          "jest": "^29.0.0"
        }
      }`
    ];

    duplicateConfigs.forEach((config, index) => {
      const packagePath = path.join(tempDir, `duplicate-${index}.json`);
      fs.writeFileSync(packagePath, config);
      
      const isValid = validator.validatePackageStructure(packagePath);
      expect(isValid).toBe(false);
      expect(validator.getIssues().length).toBeGreaterThan(0);
      expect(validator.getIssues().some(issue => 
        issue.includes('Duplicate') && issue.includes('sections')
      )).toBe(true);
      
      validator.clearIssues();
    });
  });

  test('TypeScript dependencies validation works correctly', () => {
    // Valid TypeScript configuration
    const validTsConfig = {
      name: 'web-app',
      version: '1.0.0',
      dependencies: {
        'typescript': '^5.3.2',
        '@types/react': '^18.2.38',
        '@types/node': '^20.9.0'
      }
    };

    const validPath = path.join(tempDir, 'valid-ts.json');
    fs.writeFileSync(validPath, JSON.stringify(validTsConfig, null, 2));
    
    const isValid = validator.verifyTypescriptDependencies(validPath);
    expect(isValid).toBe(true);
    expect(validator.getIssues()).toHaveLength(0);

    validator.clearIssues();

    // Invalid TypeScript configuration (missing dependencies)
    const invalidTsConfig = {
      name: 'web-app',
      version: '1.0.0',
      dependencies: {
        'react': '^18.0.0'
      }
    };

    const invalidPath = path.join(tempDir, 'invalid-ts.json');
    fs.writeFileSync(invalidPath, JSON.stringify(invalidTsConfig, null, 2));
    
    const isInvalid = validator.verifyTypescriptDependencies(invalidPath);
    expect(isInvalid).toBe(false);
    expect(validator.getIssues().length).toBeGreaterThan(0);
    expect(validator.getIssues().some(issue => 
      issue.includes('Missing TypeScript dependencies')
    )).toBe(true);
  });

  test('Workspace dependencies validation works correctly', () => {
    // Create a mock workspace structure
    const libsDir = path.join(tempDir, 'libs', 'shared');
    fs.mkdirSync(libsDir, { recursive: true });
    fs.writeFileSync(path.join(libsDir, 'package.json'), JSON.stringify({
      name: '@syspro/shared',
      version: '1.0.0'
    }, null, 2));

    // Valid workspace configuration
    const validWorkspaceConfig = {
      name: 'web-app',
      version: '1.0.0',
      dependencies: {
        '@syspro/shared': 'workspace:*'
      }
    };

    const validPath = path.join(tempDir, 'valid-workspace.json');
    fs.writeFileSync(validPath, JSON.stringify(validWorkspaceConfig, null, 2));
    
    // Change working directory temporarily for workspace resolution
    const originalCwd = process.cwd();
    process.chdir(tempDir);
    
    try {
      const isValid = validator.validateWorkspaceDependencies(validPath);
      expect(isValid).toBe(true);
      expect(validator.getIssues()).toHaveLength(0);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('Comprehensive validation integrates all checks', () => {
    // This test validates the overall system behavior
    const result = validator.validateAllPackages();
    
    expect(result).toHaveProperty('packageConfigValid');
    expect(result).toHaveProperty('typescriptDepsAvailable');
    expect(result).toHaveProperty('deploymentReady');
    expect(result).toHaveProperty('issues');
    expect(Array.isArray(result.issues)).toBe(true);
  });
});