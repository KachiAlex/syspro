#!/usr/bin/env ts-node

/**
 * Module Registry System - Checkpoint Validation Script
 * 
 * This script validates that all core module registry functionality is working correctly
 * before proceeding to integration tasks.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../apps/api/src/app.module';
import { ModuleRegistryService } from '../apps/api/src/modules/module-registry/module-registry.service';
import { TenantModuleService } from '../apps/api/src/modules/module-registry/tenant-module.service';
import { ModuleUsageAnalyticsService } from '../apps/api/src/modules/module-registry/module-usage-analytics.service';
import { Logger } from '@nestjs/common';

interface CheckpointResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message?: string;
  error?: string;
}

class ModuleRegistryCheckpoint {
  private readonly logger = new Logger(ModuleRegistryCheckpoint.name);
  private results: CheckpointResult[] = [];
  private app: any;

  async run(): Promise<void> {
    this.logger.log('🚀 Starting Module Registry System Checkpoint Validation');
    
    try {
      // Initialize NestJS application
      await this.initializeApp();
      
      // Run validation tests
      await this.validateCoreServices();
      await this.validateModuleRegistration();
      await this.validateTenantModuleOperations();
      await this.validateAnalyticsService();
      await this.validateIntegration();
      
      // Display results
      this.displayResults();
      
    } catch (error) {
      this.logger.error('❌ Checkpoint validation failed:', error);
      process.exit(1);
    } finally {
      if (this.app) {
        await this.app.close();
      }
    }
  }

  private async initializeApp(): Promise<void> {
    try {
      this.app = await NestFactory.createApplicationContext(AppModule, {
        logger: false, // Reduce noise during validation
      });
      
      this.addResult({
        test: 'Application Initialization',
        status: 'PASS',
        message: 'NestJS application context created successfully'
      });
    } catch (error) {
      this.addResult({
        test: 'Application Initialization',
        status: 'FAIL',
        error: error.message
      });
      throw error;
    }
  }

  private async validateCoreServices(): Promise<void> {
    this.logger.log('🔍 Validating Core Services...');

    try {
      // Test ModuleRegistryService
      const moduleRegistryService = this.app.get(ModuleRegistryService);
      if (!moduleRegistryService) {
        throw new Error('ModuleRegistryService not found');
      }

      // Test TenantModuleService
      const tenantModuleService = this.app.get(TenantModuleService);
      if (!tenantModuleService) {
        throw new Error('TenantModuleService not found');
      }

      // Test ModuleUsageAnalyticsService
      const analyticsService = this.app.get(ModuleUsageAnalyticsService);
      if (!analyticsService) {
        throw new Error('ModuleUsageAnalyticsService not found');
      }

      this.addResult({
        test: 'Core Services Initialization',
        status: 'PASS',
        message: 'All core services are properly initialized and injectable'
      });

    } catch (error) {
      this.addResult({
        test: 'Core Services Initialization',
        status: 'FAIL',
        error: error.message
      });
    }
  }

  private async validateModuleRegistration(): Promise<void> {
    this.logger.log('📦 Validating Module Registration...');

    try {
      const moduleRegistryService = this.app.get(ModuleRegistryService);
      
      // Test getting all modules (should not throw)
      const modules = await moduleRegistryService.getAllModules();
      
      this.addResult({
        test: 'Module Registry - Get All Modules',
        status: 'PASS',
        message: `Retrieved ${modules.length} modules from registry`
      });

      // Test getting a specific module
      if (modules.length > 0) {
        const firstModule = modules[0];
        const retrievedModule = await moduleRegistryService.getModuleByName(firstModule.name);
        
        if (retrievedModule && retrievedModule.name === firstModule.name) {
          this.addResult({
            test: 'Module Registry - Get Module By Name',
            status: 'PASS',
            message: `Successfully retrieved module: ${firstModule.name}`
          });
        } else {
          this.addResult({
            test: 'Module Registry - Get Module By Name',
            status: 'FAIL',
            error: 'Retrieved module does not match expected module'
          });
        }
      } else {
        this.addResult({
          test: 'Module Registry - Get Module By Name',
          status: 'SKIP',
          message: 'No modules available for testing'
        });
      }

    } catch (error) {
      this.addResult({
        test: 'Module Registration Validation',
        status: 'FAIL',
        error: error.message
      });
    }
  }

  private async validateTenantModuleOperations(): Promise<void> {
    this.logger.log('🏢 Validating Tenant Module Operations...');

    try {
      const tenantModuleService = this.app.get(TenantModuleService);
      
      // Test getting tenant modules (should not throw even with invalid tenant)
      const testTenantId = 'test-tenant-id';
      const tenantModules = await tenantModuleService.getTenantModules(testTenantId);
      
      this.addResult({
        test: 'Tenant Module - Get Tenant Modules',
        status: 'PASS',
        message: `Retrieved ${tenantModules.length} modules for tenant`
      });

      // Test module access check
      const hasAccess = await tenantModuleService.hasModuleAccess(testTenantId, 'test-module');
      
      this.addResult({
        test: 'Tenant Module - Access Check',
        status: 'PASS',
        message: `Module access check completed (result: ${hasAccess})`
      });

    } catch (error) {
      this.addResult({
        test: 'Tenant Module Operations',
        status: 'FAIL',
        error: error.message
      });
    }
  }

  private async validateAnalyticsService(): Promise<void> {
    this.logger.log('📊 Validating Analytics Service...');

    try {
      const analyticsService = this.app.get(ModuleUsageAnalyticsService);
      
      // Test real-time stats (should not throw)
      const realTimeStats = await analyticsService.getRealTimeStats();
      
      if (realTimeStats && typeof realTimeStats.activeRequests === 'number') {
        this.addResult({
          test: 'Analytics - Real-time Stats',
          status: 'PASS',
          message: `Real-time stats retrieved successfully (${realTimeStats.activeRequests} active requests)`
        });
      } else {
        this.addResult({
          test: 'Analytics - Real-time Stats',
          status: 'FAIL',
          error: 'Real-time stats format is invalid'
        });
      }

      // Test usage metrics
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const endDate = new Date();
      
      const usageMetrics = await analyticsService.getModuleUsageMetrics(
        'test-module',
        startDate,
        endDate
      );

      if (usageMetrics && typeof usageMetrics.totalRequests === 'number') {
        this.addResult({
          test: 'Analytics - Usage Metrics',
          status: 'PASS',
          message: `Usage metrics retrieved successfully (${usageMetrics.totalRequests} total requests)`
        });
      } else {
        this.addResult({
          test: 'Analytics - Usage Metrics',
          status: 'FAIL',
          error: 'Usage metrics format is invalid'
        });
      }

    } catch (error) {
      this.addResult({
        test: 'Analytics Service Validation',
        status: 'FAIL',
        error: error.message
      });
    }
  }

  private async validateIntegration(): Promise<void> {
    this.logger.log('🔗 Validating Service Integration...');

    try {
      const moduleRegistryService = this.app.get(ModuleRegistryService);
      const tenantModuleService = this.app.get(TenantModuleService);
      const analyticsService = this.app.get(ModuleUsageAnalyticsService);

      // Test that services can work together
      const modules = await moduleRegistryService.getAllModules();
      const testTenantId = 'integration-test-tenant';
      
      // Test analytics event tracking (should not throw)
      await analyticsService.trackModuleEvent(
        testTenantId,
        'test-module',
        'activated',
        'test-user-id'
      );

      this.addResult({
        test: 'Service Integration',
        status: 'PASS',
        message: 'Services can interact with each other successfully'
      });

    } catch (error) {
      this.addResult({
        test: 'Service Integration',
        status: 'FAIL',
        error: error.message
      });
    }
  }

  private addResult(result: CheckpointResult): void {
    this.results.push(result);
  }

  private displayResults(): void {
    this.logger.log('\n📋 Checkpoint Validation Results:');
    this.logger.log('=' .repeat(80));

    let passCount = 0;
    let failCount = 0;
    let skipCount = 0;

    this.results.forEach((result, index) => {
      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
      const statusColor = result.status === 'PASS' ? '\x1b[32m' : result.status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
      const resetColor = '\x1b[0m';

      console.log(`${statusIcon} ${statusColor}${result.status}${resetColor} - ${result.test}`);
      
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

    this.logger.log('=' .repeat(80));
    this.logger.log(`📊 Summary: ${passCount} passed, ${failCount} failed, ${skipCount} skipped`);

    if (failCount === 0) {
      this.logger.log('🎉 All checkpoint validations passed! Core module registry functionality is working correctly.');
      this.logger.log('✅ Ready to proceed to integration tasks (billing, permissions, webhooks).');
    } else {
      this.logger.error('❌ Some validations failed. Please review and fix issues before proceeding.');
      process.exit(1);
    }
  }
}

// Run the checkpoint validation
if (require.main === module) {
  const checkpoint = new ModuleRegistryCheckpoint();
  checkpoint.run().catch((error) => {
    console.error('Checkpoint validation failed:', error);
    process.exit(1);
  });
}

export { ModuleRegistryCheckpoint };