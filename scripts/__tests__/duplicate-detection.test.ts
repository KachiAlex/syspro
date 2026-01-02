import * as fs from 'fs';
import * as path from 'path';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { PackageValidator } from '../package-validator';

/**
 * Property-Based Test for Duplicate Section Detection
 * Feature: deployment-fixes, Property 2: Duplicate Section Detection
 * Validates: Requirements 1.2
 */

describe('Duplicate Section Detection Property Tests', () => {
  let validator: PackageValidator;
  let tempDir: string;

  beforeEach(() => {
    validator = new PackageValidator();
    tempDir = fs.mkdtempSync(path.join(__dirname, 'temp-duplicate-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Property 2: Duplicate Section Detection
   * For any package.json file containing duplicate dependency sections,
   * the build system should fail with a clear error message indicating the structural problem
   */
  test('Property 2: Duplicate Section Detection - generates various duplicate configurations and validates detection', () => {
    // Generate different types of duplicate section scenarios
    const duplicateScenarios = [
      {
        name: 'duplicate-dependencies',
        content: `{
          "name": "test-package",
          "version": "1.0.0",
          "dependencies": {
            "react": "^18.0.0",
            "typescript": "^5.0.0"
          },
          "devDependencies": {
            "@types/node": "^20.0.0"
          },
          "dependencies": {
            "axios": "^1.0.0",
            "zod": "^3.0.0"
          }
        }`,
        expectedError: 'Duplicate "dependencies" sections'
      },
      {
        name: 'duplicate-devDependencies',
        content: `{
          "name": "test-package",
          "version": "1.0.0",
          "dependencies": {
            "react": "^18.0.0"
          },
          "devDependencies": {
            "@types/node": "^20.0.0",
            "jest": "^29.0.0"
          },
          "devDependencies": {
            "@types/react": "^18.0.0",
            "typescript": "^5.0.0"
          }
        }`,
        expectedError: 'Duplicate "devDependencies" sections'
      },
      {
        name: 'multiple-duplicates',
        content: `{
          "name": "test-package",
          "version": "1.0.0",
          "dependencies": {
            "react": "^18.0.0"
          },
          "devDependencies": {
            "@types/node": "^20.0.0"
          },
          "dependencies": {
            "axios": "^1.0.0"
          },
          "devDependencies": {
            "jest": "^29.0.0"
          }
        }`,
        expectedError: 'Duplicate'
      },
      {
        name: 'triple-dependencies',
        content: `{
          "name": "test-package",
          "version": "1.0.0",
          "dependencies": {
            "react": "^18.0.0"
          },
          "dependencies": {
            "axios": "^1.0.0"
          },
          "dependencies": {
            "zod": "^3.0.0"
          }
        }`,
        expectedError: 'Duplicate "dependencies" sections'
      }
    ];

    duplicateScenarios.forEach((scenario, index) => {
      const packagePath = path.join(tempDir, `${scenario.name}-${index}.json`);
      fs.writeFileSync(packagePath, scenario.content);
      
      // Clear previous issues
      validator.clearIssues();
      
      // Validate the package
      const isValid = validator.validatePackageStructure(packagePath);
      const issues = validator.getIssues();
      
      // Should fail validation
      expect(isValid).toBe(false);
      
      // Should have issues
      expect(issues.length).toBeGreaterThan(0);
      
      // Should contain expected error message
      const hasExpectedError = issues.some(issue => 
        issue.includes(scenario.expectedError)
      );
      expect(hasExpectedError).toBe(true);
      
      // Error message should be clear and actionable
      const duplicateError = issues.find(issue => issue.includes('Duplicate'));
      expect(duplicateError).toBeDefined();
      expect(duplicateError).toContain('sections found');
      expect(duplicateError).toContain(packagePath);
    });
  });

  test('Valid configurations without duplicates should pass', () => {
    // Generate valid configurations to ensure we don't have false positives
    const validConfigurations = [
      {
        name: 'single-dependencies',
        content: `{
          "name": "test-package",
          "version": "1.0.0",
          "dependencies": {
            "react": "^18.0.0",
            "typescript": "^5.0.0",
            "axios": "^1.0.0"
          }
        }`
      },
      {
        name: 'single-devDependencies',
        content: `{
          "name": "test-package",
          "version": "1.0.0",
          "devDependencies": {
            "@types/node": "^20.0.0",
            "jest": "^29.0.0",
            "@types/react": "^18.0.0"
          }
        }`
      },
      {
        name: 'both-sections-single',
        content: `{
          "name": "test-package",
          "version": "1.0.0",
          "dependencies": {
            "react": "^18.0.0",
            "axios": "^1.0.0"
          },
          "devDependencies": {
            "@types/node": "^20.0.0",
            "jest": "^29.0.0"
          }
        }`
      },
      {
        name: 'no-dependencies',
        content: `{
          "name": "test-package",
          "version": "1.0.0",
          "scripts": {
            "build": "tsc"
          }
        }`
      }
    ];

    validConfigurations.forEach((config, index) => {
      const packagePath = path.join(tempDir, `valid-${config.name}-${index}.json`);
      fs.writeFileSync(packagePath, config.content);
      
      validator.clearIssues();
      
      const isValid = validator.validatePackageStructure(packagePath);
      const issues = validator.getIssues();
      
      expect(isValid).toBe(true);
      expect(issues.filter(issue => issue.includes('Duplicate')).length).toBe(0);
    });
  });

  test('Edge cases in duplicate detection', () => {
    // Test edge cases that might confuse the duplicate detection
    const edgeCases = [
      {
        name: 'dependencies-in-string',
        content: `{
          "name": "test-package",
          "version": "1.0.0",
          "description": "This package has dependencies in the description",
          "dependencies": {
            "react": "^18.0.0"
          }
        }`,
        shouldPass: true
      },
      {
        name: 'commented-dependencies',
        content: `{
          "name": "test-package",
          "version": "1.0.0",
          "dependencies": {
            "react": "^18.0.0"
          }
        }`,
        shouldPass: true
      },
      {
        name: 'nested-dependencies-object',
        content: `{
          "name": "test-package",
          "version": "1.0.0",
          "config": {
            "dependencies": {
              "note": "This is not a real dependencies section"
            }
          },
          "dependencies": {
            "react": "^18.0.0"
          }
        }`,
        shouldPass: true
      }
    ];

    edgeCases.forEach((edgeCase, index) => {
      const packagePath = path.join(tempDir, `edge-${edgeCase.name}-${index}.json`);
      fs.writeFileSync(packagePath, edgeCase.content);
      
      validator.clearIssues();
      
      const isValid = validator.validatePackageStructure(packagePath);
      
      if (edgeCase.shouldPass) {
        expect(isValid).toBe(true);
        expect(validator.getIssues().filter(issue => 
          issue.includes('Duplicate')
        ).length).toBe(0);
      } else {
        expect(isValid).toBe(false);
        expect(validator.getIssues().some(issue => 
          issue.includes('Duplicate')
        )).toBe(true);
      }
    });
  });
});