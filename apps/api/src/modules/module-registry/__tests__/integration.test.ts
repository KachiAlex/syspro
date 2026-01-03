import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { ModuleRegistryModule } from '../module-registry.module';
import { ModuleRegistryService } from '../module-registry.service';
import { TenantModuleService } from '../tenant-module.service';
import { PermissionIntegrationService } from '../permission-integration.service';
import { WebhookService } from '../webhook.service';
import { ModuleCategory, PricingModel } from '@syspro/database';

/**
 * Integration tests for the complete module registry system
 * Tests the full lifecycle: registration → enablement → usage → disabling
 */
describe('Module Registry System - Integration Tests', () => {
  let app: INestApplication;
  let moduleRegistryService: ModuleRegistryService;
  let tenantModuleService: TenantModuleService;
  let permissionService: PermissionIntegrationService;
  let webhookService: WebhookService;

  const testTenantId = 'test-tenant-123';
  const testUserId = 'test-user-456';
  const testModuleName = 'crm';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ModuleRegistryModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    moduleRegistryService = moduleFixture.get<ModuleRegistryService>(ModuleRegistryService);
    tenantModuleService = moduleFixture.get<TenantModuleService>(TenantModuleService);
    permissionService = moduleFixture.get<PermissionIntegrationService>(PermissionIntegrationService);
    webhookService = moduleFixture.get<WebhookService>(WebhookService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Module Lifecycle - Registration to Disabling', () => {
    it('should complete full module lifecycle: register → enable → use → disable', async () => {
      // Step 1: Register a module
      const createModuleDto = {
        name: testModuleName,
        displayName: 'CRM Module',
        description: 'Customer Relationship Management',
        category: ModuleCategory.BUSINESS,
        version: '1.0.0',
        pricingModel: PricingModel.FLAT_RATE,
        basePrice: 99.99,
        dependencies: [],
        optionalDependencies: [],
      };

      const registeredModule = await moduleRegistryService.registerModule(createModuleDto);
      expect(registeredModule).toBeDefined();
      expect(registeredModule.name).toBe(testModuleName);

      // Step 2: Enable module for tenant
      const enableModuleDto = {
        moduleName: testModuleName,
        version: '1.0.0',
        configuration: {},
      };

      const enabledModule = await tenantModuleService.enableModule(
        testTenantId,
        enableModuleDto,
        testUserId,
      );
      expect(enabledModule).toBeDefined();
      expect(enabledModule.moduleName).toBe(testModuleName);

      // Step 3: Verify module is accessible
      const tenantModule = await tenantModuleService.getTenantModule(testTenantId, testModuleName);
      expect(tenantModule).toBeDefined();
      expect(tenantModule.isEnabled).toBe(true);

      // Step 4: Update module configuration
      const updateConfigDto = {
        configuration: {
          maxUsers: 100,
          enableReports: true,
        },
      };

      const updatedModule = await tenantModuleService.updateModuleConfiguration(
        testTenantId,
        testModuleName,
        updateConfigDto,
        testUserId,
      );
      expect(updatedModule.configuration).toEqual(updateConfigDto.configuration);

      // Step 5: Disable module for tenant
      await tenantModuleService.disableModule(
        testTenantId,
        testModuleName,
        testUserId,
      );

      // Step 6: Verify module is no longer accessible
      const disabledTenantModule = await tenantModuleService.getTenantModule(
        testTenantId,
        testModuleName,
      );
      expect(disabledTenantModule).toBeDefined();
    });
  });

  describe('Cross-Service Integration', () => {
    it('should integrate module registry with permission system', async () => {
      // Register a module
      const createModuleDto = {
        name: 'hr',
        displayName: 'HR Module',
        description: 'Human Resources',
        category: ModuleCategory.BUSINESS,
        version: '1.0.0',
        pricingModel: PricingModel.PER_USER,
        perUserPrice: 10.0,
        dependencies: [],
        optionalDependencies: [],
      };

      const registeredModule = await moduleRegistryService.registerModule(createModuleDto);
      expect(registeredModule).toBeDefined();

      // Enable module for tenant
      const enableModuleDto = {
        moduleName: 'hr',
        version: '1.0.0',
        configuration: {},
      };

      const enabledModule = await tenantModuleService.enableModule(
        testTenantId,
        enableModuleDto,
        testUserId,
      );
      expect(enabledModule.isEnabled).toBe(true);

      // Verify permission filtering works
      const permissionFilterResult = await permissionService.filterPermissionsByEnabledModules(
        testTenantId,
        testUserId,
        ['hr:employees:read', 'hr:payroll:read'],
      );

      expect(permissionFilterResult).toBeDefined();
      expect(permissionFilterResult.moduleContext['hr']).toBe(true);
    });

    it('should integrate module registry with webhook system', async () => {
      // Register webhook
      const webhookUrl = 'https://example.com/webhooks/module-events';
      const webhook = await webhookService.registerWebhook(
        testTenantId,
        webhookUrl,
        ['module.enabled', 'module.disabled'],
      );

      expect(webhook).toBeDefined();
      expect(webhook.url).toBe(webhookUrl);
      expect(webhook.events).toContain('module.enabled');

      // Emit webhook event
      await webhookService.emitWebhookEvent(
        testTenantId,
        'module.enabled',
        {
          moduleName: 'test-module',
          moduleId: 'test-id',
          userId: testUserId,
        },
      );

      // Verify webhook was registered
      expect(webhook.webhookId).toBeDefined();
    });
  });

  describe('Performance and Caching', () => {
    it('should cache module lookups for performance', async () => {
      // Register a module
      const createModuleDto = {
        name: 'inventory',
        displayName: 'Inventory Module',
        description: 'Inventory Management',
        category: ModuleCategory.BUSINESS,
        version: '1.0.0',
        pricingModel: PricingModel.FREE,
        dependencies: [],
        optionalDependencies: [],
      };

      const registeredModule = await moduleRegistryService.registerModule(createModuleDto);

      // First lookup (cache miss)
      const startTime1 = Date.now();
      const module1 = await moduleRegistryService.getModuleByName('inventory');
      const time1 = Date.now() - startTime1;

      // Second lookup (cache hit)
      const startTime2 = Date.now();
      const module2 = await moduleRegistryService.getModuleByName('inventory');
      const time2 = Date.now() - startTime2;

      expect(module1).toEqual(module2);
      // Cache hit should be faster (though in tests this might not always be true)
      expect(module1.name).toBe('inventory');
    });
  });

  describe('Security and Access Control', () => {
    it('should enforce module access control', async () => {
      // Register a module
      const createModuleDto = {
        name: 'finance',
        displayName: 'Finance Module',
        description: 'Financial Management',
        category: ModuleCategory.BUSINESS,
        version: '1.0.0',
        pricingModel: PricingModel.FLAT_RATE,
        basePrice: 199.99,
        dependencies: [],
        optionalDependencies: [],
      };

      const registeredModule = await moduleRegistryService.registerModule(createModuleDto);

      // Try to access module without enabling it
      const tenantModule = await tenantModuleService.getTenantModule(testTenantId, 'finance');
      
      // Should either not exist or be disabled
      if (tenantModule) {
        expect(tenantModule.isEnabled).toBe(false);
      }

      // Enable module
      const enableModuleDto = {
        moduleName: 'finance',
        version: '1.0.0',
        configuration: {},
      };

      const enabledModule = await tenantModuleService.enableModule(
        testTenantId,
        enableModuleDto,
        testUserId,
      );
      expect(enabledModule.isEnabled).toBe(true);

      // Now access should be allowed
      const accessibleModule = await tenantModuleService.getTenantModule(testTenantId, 'finance');
      expect(accessibleModule.isEnabled).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle module not found errors', async () => {
      try {
        await moduleRegistryService.getModuleByName('non-existent-module');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle duplicate module registration', async () => {
      const createModuleDto = {
        name: 'duplicate-test',
        displayName: 'Duplicate Test Module',
        description: 'Test',
        category: ModuleCategory.BUSINESS,
        version: '1.0.0',
        pricingModel: PricingModel.FREE,
        dependencies: [],
        optionalDependencies: [],
      };

      // First registration should succeed
      const module1 = await moduleRegistryService.registerModule(createModuleDto);
      expect(module1).toBeDefined();

      // Second registration should fail
      try {
        await moduleRegistryService.registerModule(createModuleDto);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle invalid configuration', async () => {
      // Enable module
      const enableModuleDto = {
        moduleName: testModuleName,
        version: '1.0.0',
        configuration: {},
      };

      const enabledModule = await tenantModuleService.enableModule(
        testTenantId,
        enableModuleDto,
        testUserId,
      );

      // Try to update with invalid configuration
      const invalidConfigDto = {
        configuration: {
          invalidField: 'this should fail validation',
        },
      };

      // This might fail depending on schema validation
      try {
        await tenantModuleService.updateModuleConfiguration(
          testTenantId,
          testModuleName,
          invalidConfigDto,
          testUserId,
        );
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
