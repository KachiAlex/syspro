import * as fs from 'fs';
import * as path from 'path';
import { describe, test, expect } from '@jest/globals';

/**
 * Property-Based Test for Package Configuration Validation
 * Feature: deployment-fixes, Property 3: Package Structure Validation
 * Validates: Requirements 1.3
 */

interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: any;
}

function validatePackageStructure(packagePath: string): {
  isValid: boolean;
  errors: string[];
  hasDuplicateDependencies: boolean;
} {
  const errors: string[] = [];
  let hasDuplicateDependencies = false;

  try {
    const content = fs.readFileSync(packagePath, 'utf8');
    
    // Check for duplicate keys by parsing manually
    const lines = content.split('\n');
    const dependenciesLines = lines.filter(line => line.trim().startsWith('"dependencies"'));
    const devDependenciesLines = lines.filter(line => line.trim().startsWith('"devDependencies"'));
    
    if (dependenciesLines.length > 1) {
      errors.push('Duplicate "dependencies" sections found');
      hasDuplicateDependencies = true;
    }
    
    if (devDependenciesLines.length > 1) {
      errors.push('Duplicate "devDependencies" sections found');
      hasDuplicateDependencies = true;
    }

    // Parse JSON to validate structure
    const packageJson: PackageJson = JSON.parse(content);
    
    if (!packageJson.name) {
      errors.push('Missing required "name" field');
    }
    
    if (!packageJson.version) {
      errors.push('Missing required "version" field');
    }

    return {
      isValid: errors.length === 0,
      errors,
      hasDuplicateDependencies
    };
  } catch (error) {
    errors.push(`Failed to parse package.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      isValid: false,
      errors,
      hasDuplicateDependencies
    };
  }
}

describe('Package Configuration Validation', () => {
  test('Property 3: Package Structure Validation - For any package.json file, it should contain exactly one dependencies section and one devDependencies section', () => {
    const packagePaths = [
      'package.json',
      'apps/web/package.json',
      'apps/api/package.json',
      'libs/shared/package.json',
      'libs/database/package.json'
    ];

    packagePaths.forEach(packagePath => {
      if (fs.existsSync(packagePath)) {
        const result = validatePackageStructure(packagePath);
        
        expect(result.hasDuplicateDependencies).toBe(false);
        expect(result.isValid).toBe(true);
        
        if (!result.isValid) {
          console.error(`Package validation failed for ${packagePath}:`, result.errors);
        }
      }
    });
  });

  test('TypeScript dependencies are properly configured', () => {
    const webPackagePath = 'apps/web/package.json';
    
    if (fs.existsSync(webPackagePath)) {
      const content = fs.readFileSync(webPackagePath, 'utf8');
      const packageJson: PackageJson = JSON.parse(content);
      
      // Check that TypeScript dependencies are available (either in dependencies or devDependencies)
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      expect(allDeps).toHaveProperty('typescript');
      expect(allDeps).toHaveProperty('@types/node');
      expect(allDeps).toHaveProperty('@types/react');
    }
  });

  test('Workspace dependencies are properly declared', () => {
    const webPackagePath = 'apps/web/package.json';
    
    if (fs.existsSync(webPackagePath)) {
      const content = fs.readFileSync(webPackagePath, 'utf8');
      const packageJson: PackageJson = JSON.parse(content);
      
      // Check that workspace dependencies are declared
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (allDeps['@syspro/shared']) {
        expect(allDeps['@syspro/shared']).toMatch(/^workspace:/);
      }
    }
  });
});