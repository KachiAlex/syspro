#!/usr/bin/env node

/**
 * Simple Module Registry System - Checkpoint Validation
 * 
 * This script performs basic validation checks on the module registry system
 * without requiring full application compilation.
 */

const fs = require('fs');
const path = require('path');

class SimpleCheckpointValidator {
  constructor() {
    this.results = [];
    this.logger = console;
  }

  async run() {
    this.logger.log('🚀 Starting Simple Module Registry System Checkpoint Validation');
    
    try {
      this.validateFileStructure();
      this.validateEntityFiles();
      this.validateServiceFiles();
      this.validateControllerFiles();
      this.validateMiddlewareFiles();
      this.validateDTOFiles();
      this.validateMigrationFiles();
      this.validateSeedFiles();
      
      this.displayResults();
      
    } catch (error) {
      this.logger.error('❌ Checkpoint validation failed:', error);
      process.exit(1);
    }
  }

  validateFileStructure() {
    this.logger.log('📁 Validating File Structure...');

    const requiredDirectories = [
      'apps/api/src/modules/module-registry',
      'apps/api/src/modules/module-registry/dto',
      'apps/api/src/modules/module-registry/middleware',
      'libs/database/src/entities',
      'libs/database/src/migrations',
      'libs/database/src/seeds',
    ];

    requiredDirectories.forEach(dir => {
      if (fs.existsSync(dir)) {
        this.addResult({
          test: `Directory Structure - ${dir}`,
          status: 'PASS',
          message: 'Directory exists'
        });
      } else {
        this.addResult({
          test: `Directory Structure - ${dir}`,
          status: 'FAIL',
          error: 'Directory does not exist'
        });
      }
    });
  }

  validateEntityFiles() {
    this.logger.log('🗃️ Validating Entity Files...');

    const requiredEntities = [
      'libs/database/src/entities/module-registry.entity.ts',
      'libs/database/src/entities/tenant-module.entity.ts',
      'libs/database/src/entities/module-usage-analytics.entity.ts',
    ];

    requiredEntities.forEach(entityPath => {
      if (fs.existsSync(entityPath)) {
        const content = fs.readFileSync(entityPath, 'utf8');
        
        // Check for basic entity structure
        const hasEntity = content.includes('@Entity');
        const hasColumns = content.includes('@Column');
        const hasExport = content.includes('export class');

        if (hasEntity && hasColumns && hasExport) {
          this.addResult({
            test: `Entity File - ${path.basename(entityPath)}`,
            status: 'PASS',
            message: 'Entity file has proper structure'
          });
        } else {
          this.addResult({
            test: `Entity File - ${path.basename(entityPath)}`,
            status: 'FAIL',
            error: 'Entity file missing required decorators or exports'
          });
        }
      } else {
        this.addResult({
          test: `Entity File - ${path.basename(entityPath)}`,
          status: 'FAIL',
          error: 'Entity file does not exist'
        });
      }
    });
  }

  validateServiceFiles() {
    this.logger.log('⚙️ Validating Service Files...');

    const requiredServices = [
      'apps/api/src/modules/module-registry/module-registry.service.ts',
      'apps/api/src/modules/module-registry/tenant-module.service.ts',
      'apps/api/src/modules/module-registry/module-usage-analytics.service.ts',
      'apps/api/src/modules/module-registry/version-manager.service.ts',
      'apps/api/src/modules/module-registry/configuration-manager.service.ts',
      'apps/api/src/modules/module-registry/dependency-manager.service.ts',
    ];

    requiredServices.forEach(servicePath => {
      if (fs.existsSync(servicePath)) {
        const content = fs.readFileSync(servicePath, 'utf8');
        
        // Check for basic service structure
        const hasInjectable = content.includes('@Injectable');
        const hasExport = content.includes('export class');
        const hasConstructor = content.includes('constructor');

        if (hasInjectable && hasExport && hasConstructor) {
          this.addResult({
            test: `Service File - ${path.basename(servicePath)}`,
            status: 'PASS',
            message: 'Service file has proper structure'
          });
        } else {
          this.addResult({
            test: `Service File - ${path.basename(servicePath)}`,
            status: 'FAIL',
            error: 'Service file missing required decorators or structure'
          });
        }
      } else {
        this.addResult({
          test: `Service File - ${path.basename(servicePath)}`,
          status: 'FAIL',
          error: 'Service file does not exist'
        });
      }
    });
  }

  validateControllerFiles() {
    this.logger.log('🎮 Validating Controller Files...');

    const requiredControllers = [
      'apps/api/src/modules/module-registry/module-registry.controller.ts',
      'apps/api/src/modules/module-registry/tenant-module.controller.ts',
    ];

    requiredControllers.forEach(controllerPath => {
      if (fs.existsSync(controllerPath)) {
        const content = fs.readFileSync(controllerPath, 'utf8');
        
        // Check for basic controller structure
        const hasController = content.includes('@Controller');
        const hasApiTags = content.includes('@ApiTags');
        const hasEndpoints = content.includes('@Get') || content.includes('@Post') || content.includes('@Put') || content.includes('@Delete');

        if (hasController && hasApiTags && hasEndpoints) {
          this.addResult({
            test: `Controller File - ${path.basename(controllerPath)}`,
            status: 'PASS',
            message: 'Controller file has proper structure and endpoints'
          });
        } else {
          this.addResult({
            test: `Controller File - ${path.basename(controllerPath)}`,
            status: 'FAIL',
            error: 'Controller file missing required decorators or endpoints'
          });
        }
      } else {
        this.addResult({
          test: `Controller File - ${path.basename(controllerPath)}`,
          status: 'FAIL',
          error: 'Controller file does not exist'
        });
      }
    });
  }

  validateMiddlewareFiles() {
    this.logger.log('🛡️ Validating Middleware Files...');

    const middlewarePath = 'apps/api/src/modules/module-registry/middleware/module-access.middleware.ts';
    
    if (fs.existsSync(middlewarePath)) {
      const content = fs.readFileSync(middlewarePath, 'utf8');
      
      // Check for middleware structure
      const hasInjectable = content.includes('@Injectable');
      const hasNestMiddleware = content.includes('NestMiddleware');
      const hasUseMethod = content.includes('use(');

      if (hasInjectable && hasNestMiddleware && hasUseMethod) {
        this.addResult({
          test: 'Middleware File - module-access.middleware.ts',
          status: 'PASS',
          message: 'Middleware file has proper structure'
        });
      } else {
        this.addResult({
          test: 'Middleware File - module-access.middleware.ts',
          status: 'FAIL',
          error: 'Middleware file missing required structure'
        });
      }
    } else {
      this.addResult({
        test: 'Middleware File - module-access.middleware.ts',
        status: 'FAIL',
        error: 'Middleware file does not exist'
      });
    }
  }

  validateDTOFiles() {
    this.logger.log('📋 Validating DTO Files...');

    const requiredDTOs = [
      'apps/api/src/modules/module-registry/dto/module-registry.dto.ts',
      'apps/api/src/modules/module-registry/dto/tenant-module.dto.ts',
      'apps/api/src/modules/module-registry/dto/version-management.dto.ts',
      'apps/api/src/modules/module-registry/dto/configuration-management.dto.ts',
      'apps/api/src/modules/module-registry/dto/dependency-management.dto.ts',
      'apps/api/src/modules/module-registry/dto/usage-analytics.dto.ts',
    ];

    requiredDTOs.forEach(dtoPath => {
      if (fs.existsSync(dtoPath)) {
        const content = fs.readFileSync(dtoPath, 'utf8');
        
        // Check for DTO structure
        const hasExports = content.includes('export class') || content.includes('export interface');
        const hasValidation = content.includes('@IsString') || content.includes('@IsNumber') || content.includes('@IsBoolean') || content.includes('@IsOptional');

        if (hasExports) {
          this.addResult({
            test: `DTO File - ${path.basename(dtoPath)}`,
            status: 'PASS',
            message: hasValidation ? 'DTO file has exports and validation' : 'DTO file has exports'
          });
        } else {
          this.addResult({
            test: `DTO File - ${path.basename(dtoPath)}`,
            status: 'FAIL',
            error: 'DTO file missing exports'
          });
        }
      } else {
        this.addResult({
          test: `DTO File - ${path.basename(dtoPath)}`,
          status: 'FAIL',
          error: 'DTO file does not exist'
        });
      }
    });
  }

  validateMigrationFiles() {
    this.logger.log('🗄️ Validating Migration Files...');

    const requiredMigrations = [
      'libs/database/src/migrations/1700000007000-CreateModuleRegistryTable.ts',
      'libs/database/src/migrations/1700000008000-CreateTenantModulesTable.ts',
      'libs/database/src/migrations/1700000009000-CreateModuleUsageAnalyticsTable.ts',
    ];

    requiredMigrations.forEach(migrationPath => {
      if (fs.existsSync(migrationPath)) {
        const content = fs.readFileSync(migrationPath, 'utf8');
        
        // Check for migration structure
        const hasUp = content.includes('public async up');
        const hasDown = content.includes('public async down');
        const hasCreateTable = content.includes('createTable') || content.includes('CREATE TABLE');

        if (hasUp && hasDown && hasCreateTable) {
          this.addResult({
            test: `Migration File - ${path.basename(migrationPath)}`,
            status: 'PASS',
            message: 'Migration file has proper structure'
          });
        } else {
          this.addResult({
            test: `Migration File - ${path.basename(migrationPath)}`,
            status: 'FAIL',
            error: 'Migration file missing required methods or table creation'
          });
        }
      } else {
        this.addResult({
          test: `Migration File - ${path.basename(migrationPath)}`,
          status: 'FAIL',
          error: 'Migration file does not exist'
        });
      }
    });
  }

  validateSeedFiles() {
    this.logger.log('🌱 Validating Seed Files...');

    const seedPath = 'libs/database/src/seeds/module-registry.seed.ts';
    
    if (fs.existsSync(seedPath)) {
      const content = fs.readFileSync(seedPath, 'utf8');
      
      // Check for seed structure
      const hasExport = content.includes('export');
      const hasModuleData = content.includes('module') || content.includes('Module');

      if (hasExport && hasModuleData) {
        this.addResult({
          test: 'Seed File - module-registry.seed.ts',
          status: 'PASS',
          message: 'Seed file has proper structure'
        });
      } else {
        this.addResult({
          test: 'Seed File - module-registry.seed.ts',
          status: 'FAIL',
          error: 'Seed file missing required structure or data'
        });
      }
    } else {
      this.addResult({
        test: 'Seed File - module-registry.seed.ts',
        status: 'FAIL',
        error: 'Seed file does not exist'
      });
    }
  }

  addResult(result) {
    this.results.push(result);
  }

  displayResults() {
    this.logger.log('\n📋 Checkpoint Validation Results:');
    this.logger.log('='.repeat(80));

    let passCount = 0;
    let failCount = 0;
    let skipCount = 0;

    this.results.forEach((result) => {
      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
      
      console.log(`${statusIcon} ${result.status} - ${result.test}`);
      
      if (result.message) {
        console.log(`   💬 ${result.message}`);
      }
      
      if (result.error) {
        console.log(`   🚨 ${result.error}`);
      }
      
      console.log('');

      // Count results
      if (result.status === 'PASS') passCount++;
      else if (result.status === 'FAIL') failCount++;
      else skipCount++;
    });

    this.logger.log('='.repeat(80));
    this.logger.log(`📊 Summary: ${passCount} passed, ${failCount} failed, ${skipCount} skipped`);

    if (failCount === 0) {
      this.logger.log('🎉 All checkpoint validations passed! Core module registry files are properly structured.');
      this.logger.log('✅ File structure validation complete. Ready to proceed to integration tasks.');
    } else {
      this.logger.error('❌ Some validations failed. Please review and fix issues before proceeding.');
      process.exit(1);
    }
  }
}

// Run the checkpoint validation
if (require.main === module) {
  const validator = new SimpleCheckpointValidator();
  validator.run().catch((error) => {
    console.error('Checkpoint validation failed:', error);
    process.exit(1);
  });
}

module.exports = { SimpleCheckpointValidator };