import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModuleRegistryService } from '../module-registry.service';
import { TenantModuleService } from '../tenant-module.service';
import { VersionManagerService } from '../version-manager.service';
import { ConfigurationManagerService } from '../configuration-manager.service';
import { DependencyManagerService } from '../dependency-manager.service';
import { ModuleUsageAnalyticsService } from '../module-usage-analytics.service';
import { ModuleAccessMiddleware } from '../middleware/module-access.middleware';
import { CacheService } from '../../shared/services/cache.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  ModuleRegistry, 
  TenantModule, 
  ModuleUsageAnalytics,
  Tenant,
  User 
} from '@syspro/database';

describe('Module Registry System - Checkpoint Validation', () => {
  let moduleRegistryService: ModuleRegistryService;
  let tenantModuleService: TenantModuleService;
  let versionManagerService: VersionManagerService;
  let configurationManagerService: ConfigurationManagerService;
  let dependencyManagerService: DependencyManagerService;
  let analyticsService: ModuleUsageAnalyticsService;
  let moduleAccessMiddleware: ModuleAccessMiddleware;
  
  let moduleRegistryRepository: Repository<ModuleRegistry>;
  let tenantModuleRepository: Repository<TenantModule>;
  let analyticsRepository: Repository<ModuleUsageAnalytics>;
  let tenantRepository: Repository<Tenant>;
  let userRepository: Repository<User>;
  
  let cacheService: CacheService;
  let eventEmitter: EventEmitter2;

  const mockTenant = {
    id: 'test-tenant-id',
    name: 'Test Tenant',
    subdomain: 'test-tenant',
    isActive: true,
  };

  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  };

  const mockModule = {
    id: 'test-module-id',
    name: 'test-module',
    displayName: 'Test Module',
    description: 'A test module for validation',
    version: '1.0.0',
    category: 'core',
    isCore: false,
    isActive: true,
    dependencies: [],
    optionalDependencies: [],
    configurationSchema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', default: true },
        maxUsers: { type: 'number', default: 100 }
      }
    },
    defaultConfiguration: {
      enabled: true,
      maxUsers: 100
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModuleRegistryService,
        TenantModuleService,
        VersionManagerService,
        ConfigurationManagerService,
        DependencyManagerService,
        ModuleUsageAnalyticsService,
        ModuleAccessMiddleware,
        {
          provide: getRepositoryToken(ModuleRegistry),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TenantModule),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            remove: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ModuleUsageAnalytics),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    moduleRegistryService = module.get<ModuleRegistryService>(ModuleRegistryService);
    tenantModuleService = module.get<TenantModuleService>(TenantModuleService);
    versionManagerService = module.get<VersionManagerService>(VersionManagerService);
    configurationManagerService = module.get<ConfigurationManagerService>(ConfigurationManagerService);
    dependencyManagerService = module.get<DependencyManagerService>(DependencyManagerService);
    analyticsService = module.get<ModuleUsageAnalyticsService>(ModuleUsageAnalyticsService);
    moduleAccessMiddleware = module.get<ModuleAccessMiddleware>(ModuleAccessMiddleware);
    
    moduleRegistryRepository = module.get<Repository<ModuleRegistry>>(getRepositoryToken(ModuleRegistry));
    tenantModuleRepository = module.get<Repository<TenantModule>>(getRepositoryToken(TenantModule));
    analyticsRepository = module.get<Repository<ModuleUsageAnalytics>>(getRepositoryToken(ModuleUsageAnalytics));
    tenantRepository = module.get<Repository<Tenant>>(getRepositoryToken(Tenant));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    
    cacheService = module.get<CacheService>(CacheService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  describe('1. Core Services Validation', () => {
    it('should validate ModuleRegistryService is properly initialized', async () => {
      expect(moduleRegistryService).toBeDefined();
      expect(moduleRegistryService.getAllModules).toBeDefined();
      expect(moduleRegistryService.getModuleByName).toBeDefined();
      expect(moduleRegistryService.registerModule).toBeDefined();
    });

    it('should validate TenantModuleService is properly initialized', async () => {
      expect(tenantModuleService).toBeDefined();
      expect(tenantModuleService.enableModule).toBeDefined();
      expect(tenantModuleService.disableModule).toBeDefined();
      expect(tenantModuleService.getTenantModules).toBeDefined();
    });

    it('should validate all supporting services are initialized', async () => {
      expect(versionManagerService).toBeDefined();
      expect(configurationManagerService).toBeDefined();
      expect(dependencyManagerService).toBeDefined();
      expect(analyticsService).toBeDefined();
      expect(moduleAccessMiddleware).toBeDefined();
    });
  });

  describe('2. Module Registration Flow', () => {
    it('should successfully register a new module', async () => {
      // Mock repository responses
      jest.spyOn(moduleRegistryRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(moduleRegistryRepository, 'create').mockReturnValue(mockModule as any);
      jest.spyOn(moduleRegistryRepository, 'save').mockResolvedValue(mockModule as any);
      jest.spyOn(cacheService, 'del').mockResolvedValue(undefined);
      jest.spyOn(eventEmitter, 'emit').mockReturnValue(true);

      const result = await moduleRegistryService.registerModule({
        name: mockModule.name,
        displayName: mockModule.displayName,
        description: mockModule.description,
        version: mockModule.version,
        category: mockModule.category,
        configurationSchema: mockModule.configurationSchema,
        defaultConfiguration: mockModule.defaultConfiguration,
      });

      expect(result).toBeDefined();
      expect(moduleRegistryRepository.save).toHaveBeenCalled();
      expect(cacheService.del).toHaveBeenCalledWith('modules:all');
      expect(eventEmitter.emit).toHaveBeenCalledWith('module.registered', expect.any(Object));
    });

    it('should retrieve registered modules', async () => {
      jest.spyOn(moduleRegistryRepository, 'find').mockResolvedValue([mockModule as any]);
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(cacheService, 'set').mockResolvedValue(undefined);

      const modules = await moduleRegistryService.getAllModules();

      expect(modules).toBeDefined();
      expect(Array.isArray(modules)).toBe(true);
      expect(moduleRegistryRepository.find).toHaveBeenCalled();
    });

    it('should validate module compatibility', async () => {
      jest.spyOn(moduleRegistryRepository, 'findOne').mockResolvedValue(mockModule as any);

      const isCompatible = await moduleRegistryService.validateModuleCompatibility(
        mockModule.name,
        '1.0.0'
      );

      expect(typeof isCompatible).toBe('boolean');
    });
  });

  describe('3. Tenant Module Enablement Flow', () => {
    it('should successfully enable a module for a tenant', async () => {
      const mockTenantModule = {
        id: 'tenant-module-id',
        tenantId: mockTenant.id,
        moduleName: mockModule.name,
        version: mockModule.version,
        isEnabled: true,
        configuration: mockModule.defaultConfiguration,
        featureFlags: {},
        enabledAt: new Date(),
        enabledBy: mockUser.id,
      };

      // Mock repository responses
      jest.spyOn(moduleRegistryRepository, 'findOne').mockResolvedValue(mockModule as any);
      jest.spyOn(tenantModuleRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(tenantModuleRepository, 'create').mockReturnValue(mockTenantModule as any);
      jest.spyOn(tenantModuleRepository, 'save').mockResolvedValue(mockTenantModule as any);
      jest.spyOn(cacheService, 'del').mockResolvedValue(undefined);
      jest.spyOn(eventEmitter, 'emit').mockReturnValue(true);

      const result = await tenantModuleService.enableModule(
        mockTenant.id,
        {
          moduleName: mockModule.name,
          version: mockModule.version,
          configuration: mockModule.defaultConfiguration,
        },
        mockUser.id
      );

      expect(result).toBeDefined();
      expect(result.isEnabled).toBe(true);
      expect(tenantModuleRepository.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('module.enabled', expect.any(Object));
    });

    it('should retrieve tenant modules', async () => {
      const mockTenantModules = [{
        id: 'tenant-module-id',
        tenantId: mockTenant.id,
        moduleName: mockModule.name,
        isEnabled: true,
        module: mockModule,
      }];

      jest.spyOn(tenantModuleRepository, 'find').mockResolvedValue(mockTenantModules as any);

      const tenantModules = await tenantModuleService.getTenantModules(mockTenant.id);

      expect(tenantModules).toBeDefined();
      expect(Array.isArray(tenantModules)).toBe(true);
      expect(tenantModuleRepository.find).toHaveBeenCalledWith({
        where: { tenantId: mockTenant.id, isEnabled: true },
        relations: ['module'],
      });
    });

    it('should check module access for tenant', async () => {
      jest.spyOn(tenantModuleRepository, 'findOne').mockResolvedValue({
        isEnabled: true,
      } as any);
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(cacheService, 'set').mockResolvedValue(undefined);

      const hasAccess = await tenantModuleService.hasModuleAccess(
        mockTenant.id,
        mockModule.name
      );

      expect(typeof hasAccess).toBe('boolean');
      expect(tenantModuleRepository.findOne).toHaveBeenCalled();
    });
  });

  describe('4. Module Access Middleware Validation', () => {
    it('should allow access to enabled modules', async () => {
      const mockRequest = {
        headers: { 'x-tenant-id': mockTenant.id },
        path: '/api/v1/test-module/endpoint',
        method: 'GET',
      } as any;

      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const mockNext = jest.fn();

      // Mock tenant module access
      jest.spyOn(tenantModuleService, 'hasModuleAccess').mockResolvedValue(true);

      await moduleAccessMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should deny access to disabled modules', async () => {
      const mockRequest = {
        headers: { 'x-tenant-id': mockTenant.id },
        path: '/api/v1/disabled-module/endpoint',
        method: 'GET',
      } as any;

      const mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const mockNext = jest.fn();

      // Mock tenant module access denied
      jest.spyOn(tenantModuleService, 'hasModuleAccess').mockResolvedValue(false);

      await moduleAccessMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Module access denied',
        message: expect.stringContaining('disabled-module'),
      });
    });

    it('should bypass middleware for admin endpoints', async () => {
      const mockRequest = {
        headers: { 'x-tenant-id': mockTenant.id },
        path: '/api/v1/admin/modules',
        method: 'GET',
      } as any;

      const mockResponse = {} as any;
      const mockNext = jest.fn();

      await moduleAccessMiddleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
      // Should not call hasModuleAccess for admin endpoints
      expect(tenantModuleService.hasModuleAccess).not.toHaveBeenCalled();
    });
  });

  describe('5. Configuration Management Validation', () => {
    it('should validate module configuration', async () => {
      const testConfig = {
        enabled: true,
        maxUsers: 50,
      };

      jest.spyOn(moduleRegistryRepository, 'findOne').mockResolvedValue(mockModule as any);

      const validationResult = await configurationManagerService.validateConfiguration(
        mockModule.name,
        testConfig
      );

      expect(validationResult).toBeDefined();
      expect(validationResult.isValid).toBeDefined();
    });

    it('should update module configuration', async () => {
      const mockTenantModule = {
        id: 'tenant-module-id',
        tenantId: mockTenant.id,
        moduleName: mockModule.name,
        configuration: mockModule.defaultConfiguration,
        save: jest.fn().mockResolvedValue(true),
      };

      const newConfig = {
        enabled: false,
        maxUsers: 200,
      };

      jest.spyOn(tenantModuleRepository, 'findOne').mockResolvedValue(mockTenantModule as any);
      jest.spyOn(moduleRegistryRepository, 'findOne').mockResolvedValue(mockModule as any);
      jest.spyOn(cacheService, 'del').mockResolvedValue(undefined);
      jest.spyOn(eventEmitter, 'emit').mockReturnValue(true);

      const result = await configurationManagerService.updateConfiguration(
        mockTenant.id,
        mockModule.name,
        newConfig,
        mockUser.id
      );

      expect(result).toBeDefined();
      expect(mockTenantModule.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('module.configuration.updated', expect.any(Object));
    });
  });

  describe('6. Version Management Validation', () => {
    it('should get available module versions', async () => {
      const mockVersions = [
        { ...mockModule, version: '1.0.0' },
        { ...mockModule, version: '1.1.0' },
      ];

      jest.spyOn(moduleRegistryRepository, 'find').mockResolvedValue(mockVersions as any);

      const versions = await versionManagerService.getModuleVersions(mockModule.name);

      expect(versions).toBeDefined();
      expect(Array.isArray(versions)).toBe(true);
      expect(versions.length).toBeGreaterThan(0);
    });

    it('should check version compatibility', async () => {
      const isCompatible = versionManagerService.isVersionCompatible('1.0.0', '1.1.0');

      expect(typeof isCompatible).toBe('boolean');
    });
  });

  describe('7. Dependency Management Validation', () => {
    it('should analyze dependencies for module enablement', async () => {
      jest.spyOn(moduleRegistryRepository, 'findOne').mockResolvedValue(mockModule as any);
      jest.spyOn(tenantModuleRepository, 'find').mockResolvedValue([]);

      const analysis = await dependencyManagerService.analyzeDependenciesForEnable(
        mockTenant.id,
        mockModule.name
      );

      expect(analysis).toBeDefined();
      expect(analysis.canEnable).toBeDefined();
      expect(analysis.requiredActions).toBeDefined();
    });

    it('should get dependency chain', async () => {
      jest.spyOn(moduleRegistryRepository, 'findOne').mockResolvedValue(mockModule as any);

      const dependencyChain = await dependencyManagerService.getDependencyChain(mockModule.name);

      expect(dependencyChain).toBeDefined();
      expect(dependencyChain.name).toBe(mockModule.name);
    });
  });

  describe('8. Analytics Service Validation', () => {
    it('should track module events', async () => {
      jest.spyOn(eventEmitter, 'emit').mockReturnValue(true);

      await analyticsService.trackModuleEvent(
        mockTenant.id,
        mockModule.name,
        'activated',
        mockUser.id
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith('module.activated', expect.any(Object));
    });

    it('should get usage metrics', async () => {
      const mockAnalyticsData = [{
        tenantId: mockTenant.id,
        moduleName: mockModule.name,
        requestCount: 100,
        errorCount: 5,
        responseTimeMs: 150,
        date: new Date(),
        hour: 10,
      }];

      jest.spyOn(analyticsRepository, 'find').mockResolvedValue(mockAnalyticsData as any);
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(cacheService, 'set').mockResolvedValue(undefined);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const metrics = await analyticsService.getModuleUsageMetrics(
        mockModule.name,
        startDate,
        endDate,
        mockTenant.id
      );

      expect(metrics).toBeDefined();
      expect(metrics.totalRequests).toBeDefined();
      expect(metrics.totalErrors).toBeDefined();
      expect(metrics.averageResponseTime).toBeDefined();
    });
  });

  describe('9. Integration Flow Validation', () => {
    it('should complete full module lifecycle: register → enable → access → disable', async () => {
      // 1. Register module
      jest.spyOn(moduleRegistryRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(moduleRegistryRepository, 'create').mockReturnValue(mockModule as any);
      jest.spyOn(moduleRegistryRepository, 'save').mockResolvedValue(mockModule as any);
      jest.spyOn(cacheService, 'del').mockResolvedValue(undefined);
      jest.spyOn(eventEmitter, 'emit').mockReturnValue(true);

      const registeredModule = await moduleRegistryService.registerModule({
        name: mockModule.name,
        displayName: mockModule.displayName,
        description: mockModule.description,
        version: mockModule.version,
        category: mockModule.category,
        configurationSchema: mockModule.configurationSchema,
        defaultConfiguration: mockModule.defaultConfiguration,
      });

      expect(registeredModule).toBeDefined();

      // 2. Enable module for tenant
      const mockTenantModule = {
        id: 'tenant-module-id',
        tenantId: mockTenant.id,
        moduleName: mockModule.name,
        isEnabled: true,
        configuration: mockModule.defaultConfiguration,
      };

      jest.spyOn(moduleRegistryRepository, 'findOne').mockResolvedValue(mockModule as any);
      jest.spyOn(tenantModuleRepository, 'findOne')
        .mockResolvedValueOnce(null) // For enable check
        .mockResolvedValue(mockTenantModule as any); // For access check
      jest.spyOn(tenantModuleRepository, 'create').mockReturnValue(mockTenantModule as any);
      jest.spyOn(tenantModuleRepository, 'save').mockResolvedValue(mockTenantModule as any);

      const enabledModule = await tenantModuleService.enableModule(
        mockTenant.id,
        {
          moduleName: mockModule.name,
          version: mockModule.version,
          configuration: mockModule.defaultConfiguration,
        },
        mockUser.id
      );

      expect(enabledModule).toBeDefined();
      expect(enabledModule.isEnabled).toBe(true);

      // 3. Check access
      jest.spyOn(cacheService, 'get').mockResolvedValue(null);
      jest.spyOn(cacheService, 'set').mockResolvedValue(undefined);

      const hasAccess = await tenantModuleService.hasModuleAccess(
        mockTenant.id,
        mockModule.name
      );

      expect(hasAccess).toBe(true);

      // 4. Disable module
      jest.spyOn(tenantModuleRepository, 'remove').mockResolvedValue(mockTenantModule as any);

      await tenantModuleService.disableModule(
        mockTenant.id,
        mockModule.name,
        mockUser.id
      );

      expect(tenantModuleRepository.remove).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('module.disabled', expect.any(Object));
    });
  });

  describe('10. Error Handling Validation', () => {
    it('should handle module not found errors', async () => {
      jest.spyOn(moduleRegistryRepository, 'findOne').mockResolvedValue(null);

      await expect(
        tenantModuleService.enableModule(
          mockTenant.id,
          {
            moduleName: 'non-existent-module',
            version: '1.0.0',
          },
          mockUser.id
        )
      ).rejects.toThrow();
    });

    it('should handle duplicate module registration', async () => {
      jest.spyOn(moduleRegistryRepository, 'findOne').mockResolvedValue(mockModule as any);

      await expect(
        moduleRegistryService.registerModule({
          name: mockModule.name,
          displayName: mockModule.displayName,
          description: mockModule.description,
          version: mockModule.version,
          category: mockModule.category,
        })
      ).rejects.toThrow();
    });

    it('should handle invalid configuration', async () => {
      const invalidConfig = {
        enabled: 'invalid-boolean',
        maxUsers: 'invalid-number',
      };

      jest.spyOn(moduleRegistryRepository, 'findOne').mockResolvedValue(mockModule as any);

      const validationResult = await configurationManagerService.validateConfiguration(
        mockModule.name,
        invalidConfig
      );

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toBeDefined();
      expect(validationResult.errors.length).toBeGreaterThan(0);
    });
  });
});