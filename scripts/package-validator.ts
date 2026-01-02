#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

export interface PackageConfig {
  name: string;
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
}

export interface ValidationResult {
  packageConfigValid: boolean;
  typescriptDepsAvailable: boolean;
  buildSuccessful: boolean;
  deploymentReady: boolean;
  issues: string[];
}

export class PackageValidator {
  private issues: string[] = [];

  /**
   * Validates package.json structure and detects common issues
   * Implements Requirements 1.1, 1.3, 1.4
   */
  validatePackageStructure(packagePath: string): boolean {
    try {
      const content = fs.readFileSync(packagePath, 'utf8');
      
      // Check for duplicate dependency sections
      if (this.hasDuplicateSections(content)) {
        this.issues.push(`Duplicate dependency sections found in ${packagePath}`);
        return false;
      }

      // Parse and validate JSON structure
      const packageJson = JSON.parse(content) as Partial<PackageConfig>;
      
      if (!packageJson.name) {
        this.issues.push(`Missing required "name" field in ${packagePath}`);
        return false;
      }
      
      if (!packageJson.version) {
        this.issues.push(`Missing required "version" field in ${packagePath}`);
        return false;
      }

      return true;
    } catch (error) {
      this.issues.push(`Failed to parse ${packagePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Detects duplicate dependency sections in package.json
   * Implements Requirements 1.2
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
   * Verifies TypeScript dependencies are available
   * Implements Requirements 1.4, 2.1
   */
  verifyTypescriptDependencies(packagePath: string): boolean {
    try {
      const content = fs.readFileSync(packagePath, 'utf8');
      const packageJson = JSON.parse(content) as Partial<PackageConfig>;
      
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      const requiredTypescriptDeps = ['typescript', '@types/node', '@types/react'];
      const missingDeps = requiredTypescriptDeps.filter(dep => !allDeps[dep]);
      
      if (missingDeps.length > 0) {
        this.issues.push(`Missing TypeScript dependencies in ${packagePath}: ${missingDeps.join(', ')}`);
        return false;
      }

      return true;
    } catch (error) {
      this.issues.push(`Failed to verify TypeScript dependencies in ${packagePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Validates workspace dependencies are properly configured
   * Implements Requirements 1.1, 1.4
   */
  validateWorkspaceDependencies(packagePath: string): boolean {
    try {
      const content = fs.readFileSync(packagePath, 'utf8');
      const packageJson = JSON.parse(content) as Partial<PackageConfig>;
      
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      // Check for workspace dependencies
      const workspaceDeps = Object.entries(allDeps).filter(([_, version]) => 
        version.startsWith('workspace:')
      );

      // Validate workspace dependencies exist
      for (const [depName, version] of workspaceDeps) {
        if (version === 'workspace:*') {
          // Check if the workspace package exists
          const workspacePath = this.resolveWorkspacePath(depName);
          if (!fs.existsSync(workspacePath)) {
            this.issues.push(`Workspace dependency ${depName} not found at ${workspacePath}`);
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      this.issues.push(`Failed to validate workspace dependencies in ${packagePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Resolves workspace package path from package name
   */
  private resolveWorkspacePath(packageName: string): string {
    // Convert @syspro/shared -> libs/shared/package.json
    // Convert @syspro/database -> libs/database/package.json
    const name = packageName.replace('@syspro/', '');
    return path.join('libs', name, 'package.json');
  }

  /**
   * Comprehensive validation of all package configurations
   * Implements Requirements 4.1, 4.4
   */
  validateAllPackages(): ValidationResult {
    this.issues = []; // Reset issues

    const packagePaths = [
      'package.json',
      'apps/web/package.json',
      'apps/api/package.json',
      'libs/shared/package.json',
      'libs/database/package.json'
    ];

    let packageConfigValid = true;
    let typescriptDepsAvailable = true;

    // Validate each package
    for (const packagePath of packagePaths) {
      if (fs.existsSync(packagePath)) {
        if (!this.validatePackageStructure(packagePath)) {
          packageConfigValid = false;
        }

        // Only check TypeScript deps for web app
        if (packagePath === 'apps/web/package.json') {
          if (!this.verifyTypescriptDependencies(packagePath)) {
            typescriptDepsAvailable = false;
          }
          if (!this.validateWorkspaceDependencies(packagePath)) {
            packageConfigValid = false;
          }
        }
      }
    }

    return {
      packageConfigValid,
      typescriptDepsAvailable,
      buildSuccessful: false, // Will be set by build verification
      deploymentReady: packageConfigValid && typescriptDepsAvailable,
      issues: [...this.issues]
    };
  }

  /**
   * Get current validation issues
   */
  getIssues(): string[] {
    return [...this.issues];
  }

  /**
   * Clear validation issues
   */
  clearIssues(): void {
    this.issues = [];
  }
}

// CLI usage
if (require.main === module) {
  const validator = new PackageValidator();
  const result = validator.validateAllPackages();
  
  console.log('Package Configuration Validation Results:');
  console.log('========================================');
  console.log(`Package Config Valid: ${result.packageConfigValid}`);
  console.log(`TypeScript Dependencies Available: ${result.typescriptDepsAvailable}`);
  console.log(`Deployment Ready: ${result.deploymentReady}`);
  
  if (result.issues.length > 0) {
    console.log('\nIssues Found:');
    result.issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ All package configurations are valid!');
    process.exit(0);
  }
}