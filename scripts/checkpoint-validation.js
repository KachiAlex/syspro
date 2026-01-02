#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class CheckpointValidator {
  constructor() {
    this.results = {
      packageValidation: { passed: false, issues: [] },
      structureValidation: { passed: false, issues: [] },
      configValidation: { passed: false, issues: [] },
      overallStatus: false
    };
  }

  /**
   * Validates all package.json files for common issues
   */
  validatePackageConfigurations() {
    const packagePaths = [
      'package.json',
      'apps/web/package.json',
      'apps/api/package.json',
      'libs/shared/package.json',
      'libs/database/package.json'
    ];

    let allValid = true;
    const issues = [];

    for (const packagePath of packagePaths) {
      if (!fs.existsSync(packagePath)) {
        issues.push(`Missing package.json: ${packagePath}`);
        allValid = false;
        continue;
      }

      try {
        const content = fs.readFileSync(packagePath, 'utf8');
        
        // Check for duplicate dependency sections
        if (this.hasDuplicateSections(content)) {
          issues.push(`Duplicate dependency sections in ${packagePath}`);
          allValid = false;
        }

        // Parse JSON
        const packageJson = JSON.parse(content);
        
        // Check required fields
        if (!packageJson.name) {
          issues.push(`Missing name field in ${packagePath}`);
          allValid = false;
        }
        
        if (!packageJson.version) {
          issues.push(`Missing version field in ${packagePath}`);
          allValid = false;
        }

        // Check TypeScript dependencies for web app
        if (packagePath === 'apps/web/package.json') {
          const allDeps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies
          };

          const requiredTypescriptDeps = ['typescript', '@types/node', '@types/react'];
          const missingDeps = requiredTypescriptDeps.filter(dep => !allDeps[dep]);
          
          if (missingDeps.length > 0) {
            issues.push(`Missing TypeScript dependencies in ${packagePath}: ${missingDeps.join(', ')}`);
            allValid = false;
          }

          // Check for workspace dependencies
          const workspaceDeps = Object.entries(allDeps).filter(([_, version]) => 
            version.startsWith('workspace:')
          );

          for (const [depName, version] of workspaceDeps) {
            if (version === 'workspace:*') {
              const workspacePath = this.resolveWorkspacePath(depName);
              if (!fs.existsSync(workspacePath)) {
                issues.push(`Workspace dependency ${depName} not found at ${workspacePath}`);
                allValid = false;
              }
            }
          }
        }

      } catch (error) {
        issues.push(`Failed to parse ${packagePath}: ${error.message}`);
        allValid = false;
      }
    }

    this.results.packageValidation = { passed: allValid, issues };
    return allValid;
  }

  /**
   * Validates project structure
   */
  validateProjectStructure() {
    const requiredPaths = [
      'apps/web',
      'apps/api',
      'libs/shared',
      'libs/database',
      'tsconfig.json',
      'turbo.json',
      'vercel.json'
    ];

    let allValid = true;
    const issues = [];

    for (const requiredPath of requiredPaths) {
      if (!fs.existsSync(requiredPath)) {
        issues.push(`Missing required path: ${requiredPath}`);
        allValid = false;
      }
    }

    // Check TypeScript configs
    const tsconfigPaths = [
      'apps/web/tsconfig.json',
      'apps/api/tsconfig.json',
      'libs/shared/tsconfig.json',
      'libs/database/tsconfig.json'
    ];

    for (const tsconfigPath of tsconfigPaths) {
      if (fs.existsSync(tsconfigPath)) {
        try {
          const content = fs.readFileSync(tsconfigPath, 'utf8');
          JSON.parse(content);
        } catch (error) {
          issues.push(`Invalid TypeScript config ${tsconfigPath}: ${error.message}`);
          allValid = false;
        }
      }
    }

    this.results.structureValidation = { passed: allValid, issues };
    return allValid;
  }

  /**
   * Validates configuration files
   */
  validateConfigurations() {
    let allValid = true;
    const issues = [];

    // Check Vercel configuration
    if (fs.existsSync('vercel.json')) {
      try {
        const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
        if (!vercelConfig.builds || vercelConfig.builds.length === 0) {
          issues.push('Vercel configuration missing builds section');
          allValid = false;
        }
      } catch (error) {
        issues.push(`Invalid Vercel configuration: ${error.message}`);
        allValid = false;
      }
    }

    // Check Turbo configuration
    if (fs.existsSync('turbo.json')) {
      try {
        const turboConfig = JSON.parse(fs.readFileSync('turbo.json', 'utf8'));
        if (!turboConfig.pipeline) {
          issues.push('Turbo configuration missing pipeline section');
          allValid = false;
        }
      } catch (error) {
        issues.push(`Invalid Turbo configuration: ${error.message}`);
        allValid = false;
      }
    }

    this.results.configValidation = { passed: allValid, issues };
    return allValid;
  }

  /**
   * Detects duplicate dependency sections
   */
  hasDuplicateSections(content) {
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
   * Resolves workspace package path
   */
  resolveWorkspacePath(packageName) {
    const name = packageName.replace('@syspro/', '');
    return path.join('libs', name, 'package.json');
  }

  /**
   * Runs comprehensive checkpoint validation
   */
  runCheckpoint() {
    console.log('🔍 Running Checkpoint Validation...');
    console.log('=====================================\n');

    // Run all validations
    const packageValid = this.validatePackageConfigurations();
    const structureValid = this.validateProjectStructure();
    const configValid = this.validateConfigurations();

    // Overall status
    this.results.overallStatus = packageValid && structureValid && configValid;

    // Print results
    this.printResults();

    return this.results.overallStatus;
  }

  /**
   * Prints validation results
   */
  printResults() {
    console.log('📦 Package Configuration Validation:');
    console.log(`   Status: ${this.results.packageValidation.passed ? '✅ PASSED' : '❌ FAILED'}`);
    if (this.results.packageValidation.issues.length > 0) {
      console.log('   Issues:');
      this.results.packageValidation.issues.forEach(issue => {
        console.log(`     - ${issue}`);
      });
    }
    console.log();

    console.log('🏗️  Project Structure Validation:');
    console.log(`   Status: ${this.results.structureValidation.passed ? '✅ PASSED' : '❌ FAILED'}`);
    if (this.results.structureValidation.issues.length > 0) {
      console.log('   Issues:');
      this.results.structureValidation.issues.forEach(issue => {
        console.log(`     - ${issue}`);
      });
    }
    console.log();

    console.log('⚙️  Configuration Validation:');
    console.log(`   Status: ${this.results.configValidation.passed ? '✅ PASSED' : '❌ FAILED'}`);
    if (this.results.configValidation.issues.length > 0) {
      console.log('   Issues:');
      this.results.configValidation.issues.forEach(issue => {
        console.log(`     - ${issue}`);
      });
    }
    console.log();

    console.log('🎯 OVERALL CHECKPOINT STATUS:');
    console.log(`   ${this.results.overallStatus ? '✅ PASSED - Ready to proceed' : '❌ FAILED - Issues need to be resolved'}`);
    console.log();

    if (this.results.overallStatus) {
      console.log('🚀 All validations passed! The deployment validation system is ready.');
      console.log('   Next steps:');
      console.log('   - Implement pre-deployment checker (Task 5)');
      console.log('   - Add error handling and reporting (Task 6)');
      console.log('   - Create deployment scripts (Task 7)');
    } else {
      console.log('⚠️  Some validations failed. Please address the issues above before proceeding.');
    }
  }

  /**
   * Get validation results
   */
  getResults() {
    return this.results;
  }
}

// CLI usage
if (require.main === module) {
  const validator = new CheckpointValidator();
  const success = validator.runCheckpoint();
  
  process.exit(success ? 0 : 1);
}

module.exports = { CheckpointValidator };