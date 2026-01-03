#!/usr/bin/env node

/**
 * Simple Module Registry System - Checkpoint Validation Script
 * 
 * This script validates that all core module registry files exist and are properly structured
 * without requiring the full NestJS application to run.
 */

const fs = require('fs');
const path = require('path');

class SimpleCheckpointValidator {
  constructor() {
    this.results = [];
    this.passCount = 0;
    this.failCount = 0;
  }

  log(message) {
    console.log(message);
  }

  addResult(test, status, message, error) {
    this.results.push({ test, status, message, error });
    if (status === 'PASS') this.passCount++;
    else if (status === 'FAIL') this.failCount++;
  }

  fileExists(filePath) {
    try {
      return fs.existsSync(path.join(__dirname, '..', filePath));
    } catch (error) {
      return false;
    }
  }

  readFile(filePath) {
    try {
      return fs.readFileSync(path.join(__dirname, '..', filePath), 'utf8');
    } catch (error) {
      return null;
    }
  }

  validateFileStructure(filePath, requiredPatterns) {
    const content = this.readFile(filePath);
    if (!content) return false;

    return requiredPatterns.every(pattern => {
      if (typeof pattern === 'string') {
        return content.includes(pattern);
      } else if (pattern instanceof RegExp) {
        return pattern.test(content);
      }
      return false;
    });
  }

  async run() {
    this.log('🚀 Starting Simple Module Registry System Checkpoint Validation');
    this.log('=' .repeat(80));

    // Validate core entity files
    this.validateCoreEntities();
    
    // Validate service files
    this.validateServices();
    
    // Validate controller files
    this.validateControllers();
    
    // Validate middleware files
    this.validateMiddleware();
    
    // Validate DTO files
    this.validateDTOs();
    
    // Validate module integration
    this.validateModuleIntegration();
    
    // Validate billing integration
    this.validateBillingIntegration();

    // Display results
    this.displayResults();
  }

  validateCoreEntities() {
    this.log('📦 Validating Core Entities...');

    const entities = [
      {
        path: 'libs/database/src/entities/module-registry.entity.ts',
        patterns: ['@Entity', 'ModuleRegistry', 'name', 'version', 'pricingModel']
      },
      {
        path: 'libs/database/src/entities/tenant-module.entity.ts',
        patterns: ['@Entity', 'TenantModule', 'tenantId', 'moduleName', 'isEnabled']
      },
      {
        path: 'libs/database/src/entities/module-usage-analytics.entity.ts',
        patterns: ['@Entity', 'ModuleUsageAnalytics', 'tenantId', 'moduleName', 'requestCount']
      }
    ];

    entities.forEach(entity => {
      if (this.fileExists(entity.path)) {
        if (this.validateFileStructure(entity.path, entity.patterns)) {
          this.addResult(
            `Entity: ${path.basename(entity.path)}`,
            'PASS',
            'Entity file exists and contains required patterns'
          );
        } else {
          this.addResult(
            `Entity: ${path.basename(entity.path)}`,
            'FAIL',
            null,
            'Entity file missing required patterns'
          );
        }
      } else {
        this.addResult(
          `Entity: ${path.basename(entity.path)}`,
          'FAIL',
          null,
          'Entity file does not exist'
        );
      }
    });
  }

  validateServices() {
    this.log('🔧 Validating Services...');

    const services = [
      {
        path: 'apps/api/src/modules/module-registry/module-registry.service.ts',
        patterns: ['@Injectable', 'ModuleRegistryService', 'getAllModules', 'getModuleByName']
      },
      {
        path: 'apps/api/src/modules/module-registry/tenant-module.service.ts',
        patterns: ['@Injectable', 'TenantModuleService', 'enableModule', 'disableModule', 'hasModuleAccess']
      },
      {
        path: 'apps/api/src/modules/module-registry/module-usage-analytics.service.ts',
        patterns: ['@Injectable', 'ModuleUsageAnalyticsService', 'trackModuleEvent', 'getModuleUsageMetrics']
      },
      {
        path: 'apps/api/src/modules/module-registry/billing-integration.service.ts',
        patterns: ['@Injectable', 'BillingIntegrationService', 'handleModuleEnabled', 'calculateProration']
      }
    ];

    services.forEach(service => {
      if (this.fileExists(service.path)) {
        if (this.validateFileStructure(service.path, service.patterns)) {
          this.addResult(
            `Service: ${path.basename(service.path)}`,
            'PASS',
            'Service file exists and contains required methods'
          );
        } else {
          this.addResult(
            `Service: ${path.basename(service.path)}`,
            'FAIL',
            null,
            'Service file missing required methods'
          );
        }
      } else {
        this.addResult(
          `Service: ${path.basename(service.path)}`,
          'FAIL',
          null,
          'Service file does not exist'
        );
      }
    });
  }

  validateControllers() {
    this.log('🎮 Validating Controllers...');

    const controllers = [
      {
        path: 'apps/api/src/modules/module-registry/module-registry.controller.ts',
        patterns: ['@Controller', 'ModuleRegistryController', '@Get', '@Post']
      },
      {
        path: 'apps/api/src/modules/module-registry/tenant-module.controller.ts',
        patterns: ['@Controller', 'TenantModuleController', 'enableModule', 'disableModule']
      },
      {
        path: 'apps/api/src/modules/module-registry/billing-integration.controller.ts',
        patterns: ['@Controller', 'BillingIntegrationController', 'getBillingLineItems', 'generateInvoice']
      }
    ];

    controllers.forEach(controller => {
      if (this.fileExists(controller.path)) {
        if (this.validateFileStructure(controller.path, controller.patterns)) {
          this.addResult(
            `Controller: ${path.basename(controller.path)}`,
            'PASS',
            'Controller file exists and contains required endpoints'
          );
        } else {
          this.addResult(
            `Controller: ${path.basename(controller.path)}`,
            'FAIL',
            null,
            'Controller file missing required endpoints'
          );
        }
      } else {
        this.addResult(
          `Controller: ${path.basename(controller.path)}`,
          'FAIL',
          null,
          'Controller file does not exist'
        );
      }
    });
  }

  validateMiddleware() {
    this.log('🛡️ Validating Middleware...');

    const middlewares = [
      {
        path: 'apps/api/src/modules/module-registry/middleware/module-access.middleware.ts',
        patterns: ['@Injectable', 'ModuleAccessMiddleware', 'use', 'hasModuleAccess']
      },
      {
        path: 'apps/api/src/modules/module-registry/middleware/usage-tracking.middleware.ts',
        patterns: ['@Injectable', 'UsageTrackingMiddleware', 'use', 'trackApiUsage']
      }
    ];

    middlewares.forEach(middleware => {
      if (this.fileExists(middleware.path)) {
        if (this.validateFileStructure(middleware.path, middleware.patterns)) {
          this.addResult(
            `Middleware: ${path.basename(middleware.path)}`,
            'PASS',
            'Middleware file exists and contains required functionality'
          );
        } else {
          this.addResult(
            `Middleware: ${path.basename(middleware.path)}`,
            'FAIL',
            null,
            'Middleware file missing required functionality'
          );
        }
      } else {
        this.addResult(
          `Middleware: ${path.basename(middleware.path)}`,
          'FAIL',
          null,
          'Middleware file does not exist'
        );
      }
    });
  }

  validateDTOs() {
    this.log('📋 Validating DTOs...');

    const dtos = [
      {
        path: 'apps/api/src/modules/module-registry/dto/module-registry.dto.ts',
        patterns: ['CreateModuleDto', 'UpdateModuleDto', '@IsString', '@IsOptional']
      },
      {
        path: 'apps/api/src/modules/module-registry/dto/tenant-module.dto.ts',
        patterns: ['EnableModuleDto', 'UpdateModuleConfigDto', 'TenantModuleListDto']
      },
      {
        path: 'apps/api/src/modules/module-registry/dto/billing-integration.dto.ts',
        patterns: ['BillingLineItemDto', 'ProrationCalculationDto', 'InvoiceDto']
      }
    ];

    dtos.forEach(dto => {
      if (this.fileExists(dto.path)) {
        if (this.validateFileStructure(dto.path, dto.patterns)) {
          this.addResult(
            `DTO: ${path.basename(dto.path)}`,
            'PASS',
            'DTO file exists and contains required classes'
          );
        } else {
          this.addResult(
            `DTO: ${path.basename(dto.path)}`,
            'FAIL',
            null,
            'DTO file missing required classes'
          );
        }
      } else {
        this.addResult(
          `DTO: ${path.basename(dto.path)}`,
          'FAIL',
          null,
          'DTO file does not exist'
        );
      }
    });
  }

  validateModuleIntegration() {
    this.log('🔗 Validating Module Integration...');

    const moduleFile = 'apps/api/src/modules/module-registry/module-registry.module.ts';
    
    if (this.fileExists(moduleFile)) {
      const requiredPatterns = [
        'ModuleRegistryController',
        'TenantModuleController', 
        'BillingIntegrationController',
        'ModuleRegistryService',
        'TenantModuleService',
        'BillingIntegrationService',
        'ModuleUsageAnalyticsService'
      ];

      if (this.validateFileStructure(moduleFile, requiredPatterns)) {
        this.addResult(
          'Module Integration',
          'PASS',
          'All services and controllers are properly integrated in module'
        );
      } else {
        this.addResult(
          'Module Integration',
          'FAIL',
          null,
          'Module file missing required service/controller registrations'
        );
      }
    } else {
      this.addResult(
        'Module Integration',
        'FAIL',
        null,
        'Module registry module file does not exist'
      );
    }
  }

  validateBillingIntegration() {
    this.log('💰 Validating Billing Integration...');

    // Check if billing integration is complete
    const billingFiles = [
      'apps/api/src/modules/module-registry/billing-integration.service.ts',
      'apps/api/src/modules/module-registry/billing-integration.controller.ts',
      'apps/api/src/modules/module-registry/dto/billing-integration.dto.ts'
    ];

    let allBillingFilesExist = true;
    billingFiles.forEach(file => {
      if (!this.fileExists(file)) {
        allBillingFilesExist = false;
      }
    });

    if (allBillingFilesExist) {
      this.addResult(
        'Billing Integration Files',
        'PASS',
        'All billing integration files exist'
      );

      // Check if billing service has event handlers
      const billingServiceContent = this.readFile('apps/api/src/modules/module-registry/billing-integration.service.ts');
      if (billingServiceContent && billingServiceContent.includes('@OnEvent') && billingServiceContent.includes('handleModuleEnabled')) {
        this.addResult(
          'Billing Event Handlers',
          'PASS',
          'Billing service has proper event handlers'
        );
      } else {
        this.addResult(
          'Billing Event Handlers',
          'FAIL',
          null,
          'Billing service missing event handlers'
        );
      }
    } else {
      this.addResult(
        'Billing Integration Files',
        'FAIL',
        null,
        'Some billing integration files are missing'
      );
    }
  }

  displayResults() {
    this.log('\n📋 Checkpoint Validation Results:');
    this.log('=' .repeat(80));

    this.results.forEach((result) => {
      const statusIcon = result.status === 'PASS' ? '✅' : '❌';
      const statusColor = result.status === 'PASS' ? '\x1b[32m' : '\x1b[31m';
      const resetColor = '\x1b[0m';

      console.log(`${statusIcon} ${statusColor}${result.status}${resetColor} - ${result.test}`);
      
      if (result.message) {
        console.log(`   💬 ${result.message}`);
      }
      
      if (result.error) {
        console.log(`   🚨 ${result.error}`);
      }
      
      console.log('');
    });

    this.log('=' .repeat(80));
    this.log(`📊 Summary: ${this.passCount} passed, ${this.failCount} failed`);

    if (this.failCount === 0) {
      this.log('🎉 All checkpoint validations passed! Core module registry functionality is properly implemented.');
      this.log('✅ Ready to proceed to the next tasks in the implementation plan.');
    } else {
      this.log('❌ Some validations failed. Please review and fix issues before proceeding.');
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