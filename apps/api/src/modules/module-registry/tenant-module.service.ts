import { Injectable, BadRequestException, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantModule, ModuleRegistry } from '@syspro/database';
import { EnableModuleDto, UpdateModuleConfigDto } from './dto/tenant-module.dto';
import { CacheService } from '../../shared/services/cache.service';

@Injectable()
export class TenantModuleService {
  private readonly logger = new Logger(TenantModuleService.name);

  constructor(
    @InjectRepository(TenantModule)
    private tenantModuleRepository: Repository<TenantModule>,
    @InjectRepository(ModuleRegistry)
    private moduleRepository: Repository<ModuleRegistry>,
    private cacheService: CacheService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Enable a module for a tenant
   */
  async enableModule(
    tenantId: string,
    enableModuleDto: EnableModuleDto,
    userId: string,
  ): Promise<TenantModule> {
    this.logger.log(`Enabling module ${enableModuleDto.moduleName} for tenant ${tenantId}`);

    // Get module definition
    const module = await this.moduleRepository.findOne({
      where: { name: enableModuleDto.moduleName, isActive: true }
    });

    if (!module) {
      throw new NotFoundException(`Module '${enableModuleDto.moduleName}' not found or inactive`);
    }

    // Check and enable dependencies first
    await this.enableDependencies(tenantId, module.dependencies, userId);

    // Check if already enabled
    let tenantModule = await this.tenantModuleRepository.findOne({
      where: { tenantId, moduleName: enableModuleDto.moduleName }
    });

    if (tenantModule) {
      if (tenantModule.isEnabled) {
        throw new ConflictException(`Module '${enableModuleDto.moduleName}' is already enabled`);
      }
      // Re-enable previously disabled module
      tenantModule.enable(userId);
      if (enableModuleDto.configuration) {
        tenantModule.updateConfiguration(enableModuleDto.configuration);
      }
    } else {
      // Create new tenant module
      const defaultConfig = module.getDefaultConfiguration();
      const defaultFeatureFlags = module.getDefaultFeatureFlags();

      tenantModule = this.tenantModuleRepository.create({
        tenantId,
        moduleName: enableModuleDto.moduleName,
        version: module.version,
        configuration: { ...defaultConfig, ...(enableModuleDto.configuration || {}) },
        featureFlags: defaultFeatureFlags,
        enabledBy: userId,
      });
    }

    const savedModule = await this.tenantModuleRepository.save(tenantModule);

    // Clear cache
    await this.clearTenantModuleCache(tenantId);

    // Emit event for billing integration
    this.eventEmitter.emit('module.enabled', {
      type: 'module_enabled',
      tenantId,
      moduleName: enableModuleDto.moduleName,
      moduleId: module.id,
      userId,
      timestamp: new Date(),
      metadata: {
        version: module.version,
        configuration: enableModuleDto.configuration,
      },
    });

    this.logger.log(`Module ${enableModuleDto.moduleName} enabled successfully for tenant ${tenantId}`);
    return savedModule;
  }

  /**
   * Disable a module for a tenant
   */
  async disableModule(
    tenantId: string,
    moduleName: string,
    userId: string,
  ): Promise<void> {
    this.logger.log(`Disabling module ${moduleName} for tenant ${tenantId}`);

    const module = await this.moduleRepository.findOne({
      where: { name: moduleName }
    });

    if (module?.isCore) {
      throw new BadRequestException('Cannot disable core modules');
    }

    // Check for dependent modules
    await this.checkDependentModules(tenantId, moduleName);

    const tenantModule = await this.tenantModuleRepository.findOne({
      where: { tenantId, moduleName, isEnabled: true }
    });

    if (!tenantModule) {
      throw new NotFoundException(`Module '${moduleName}' is not enabled for this tenant`);
    }

    tenantModule.disable(userId);
    await this.tenantModuleRepository.save(tenantModule);

    // Clear cache
    await this.clearTenantModuleCache(tenantId);

    // Emit event
    this.eventEmitter.emit('module.disabled', {
      type: 'module_disabled',
      tenantId,
      moduleName,
      moduleId: module?.id || 'unknown',
      userId,
      timestamp: new Date(),
      metadata: {
        reason: 'user_requested',
      },
    });

    this.logger.log(`Module ${moduleName} disabled successfully for tenant ${tenantId}`);
  }

  /**
   * Get all enabled modules for a tenant
   */
  async getTenantModules(tenantId: string): Promise<TenantModule[]> {
    const cacheKey = `tenant:${tenantId}:modules`;
    let modules = await this.cacheService.get<TenantModule[]>(cacheKey);

    if (!modules) {
      modules = await this.tenantModuleRepository.find({
        where: { tenantId, isEnabled: true },
        relations: ['moduleRegistry'],
        order: { moduleName: 'ASC' }
      });
      await this.cacheService.set(cacheKey, modules, 300);
    }

    return modules;
  }

  /**
   * Get a specific tenant module
   */
  async getTenantModule(tenantId: string, moduleName: string): Promise<TenantModule | null> {
    const cacheKey = `tenant:${tenantId}:module:${moduleName}`;
    let tenantModule = await this.cacheService.get<TenantModule>(cacheKey);

    if (!tenantModule) {
      tenantModule = await this.tenantModuleRepository.findOne({
        where: { tenantId, moduleName, isEnabled: true },
        relations: ['moduleRegistry']
      });
      if (tenantModule) {
        await this.cacheService.set(cacheKey, tenantModule, 300);
      }
    }

    return tenantModule;
  }

  /**
   * Check if tenant has access to a module
   */
  async hasModuleAccess(tenantId: string, moduleName: string): Promise<boolean> {
    const cacheKey = `tenant:${tenantId}:access:${moduleName}`;
    let hasAccess = await this.cacheService.get<boolean>(cacheKey);

    if (hasAccess === null || hasAccess === undefined) {
      const tenantModule = await this.tenantModuleRepository.findOne({
        where: { tenantId, moduleName, isEnabled: true }
      });
      hasAccess = !!tenantModule;
      await this.cacheService.set(cacheKey, hasAccess, 300);
    }

    return hasAccess;
  }

  /**
   * Update module configuration for a tenant
   */
  async updateModuleConfiguration(
    tenantId: string,
    moduleName: string,
    updateDto: UpdateModuleConfigDto,
    userId: string,
  ): Promise<TenantModule> {
    this.logger.log(`Updating configuration for module ${moduleName} for tenant ${tenantId}`);

    const tenantModule = await this.tenantModuleRepository.findOne({
      where: { tenantId, moduleName, isEnabled: true },
      relations: ['moduleRegistry']
    });

    if (!tenantModule) {
      throw new NotFoundException(`Module '${moduleName}' is not enabled for this tenant`);
    }

    // Validate configuration against module schema
    if (updateDto.configuration && tenantModule.moduleRegistry) {
      const isValid = tenantModule.moduleRegistry.validateConfiguration(updateDto.configuration);
      if (!isValid) {
        throw new BadRequestException('Invalid configuration for module');
      }
    }

    // Update configuration
    if (updateDto.configuration) {
      tenantModule.updateConfiguration(updateDto.configuration);
    }

    // Update feature flags
    if (updateDto.featureFlags) {
      Object.entries(updateDto.featureFlags).forEach(([flag, enabled]) => {
        tenantModule.toggleFeatureFlag(flag, enabled);
      });
    }

    const savedModule = await this.tenantModuleRepository.save(tenantModule);

    // Clear cache
    await this.clearTenantModuleCache(tenantId);

    // Emit event
    this.eventEmitter.emit('module.configuration.updated', {
      tenantId,
      moduleName,
      configuration: updateDto.configuration,
      featureFlags: updateDto.featureFlags,
      userId,
      timestamp: new Date(),
    });

    this.logger.log(`Configuration updated for module ${moduleName} for tenant ${tenantId}`);
    return savedModule;
  }

  /**
   * Toggle a feature flag for a tenant module
   */
  async toggleFeatureFlag(
    tenantId: string,
    moduleName: string,
    flagName: string,
    enabled: boolean,
    userId: string,
  ): Promise<TenantModule> {
    this.logger.log(`Toggling feature flag ${flagName} to ${enabled} for module ${moduleName} for tenant ${tenantId}`);

    const tenantModule = await this.tenantModuleRepository.findOne({
      where: { tenantId, moduleName, isEnabled: true }
    });

    if (!tenantModule) {
      throw new NotFoundException(`Module '${moduleName}' is not enabled for this tenant`);
    }

    tenantModule.toggleFeatureFlag(flagName, enabled);
    const savedModule = await this.tenantModuleRepository.save(tenantModule);

    // Clear cache
    await this.clearTenantModuleCache(tenantId);

    // Emit event
    this.eventEmitter.emit('module.feature.toggled', {
      tenantId,
      moduleName,
      flagName,
      enabled,
      userId,
      timestamp: new Date(),
    });

    return savedModule;
  }

  /**
   * Get module usage summary for a tenant
   */
  async getModuleUsageSummary(tenantId: string): Promise<{
    totalModules: number;
    enabledModules: number;
    coreModules: number;
    businessModules: number;
    integrationModules: number;
    analyticsModules: number;
    modulesByPricing: Record<string, number>;
  }> {
    const tenantModules = await this.tenantModuleRepository.find({
      where: { tenantId, isEnabled: true },
      relations: ['moduleRegistry']
    });

    const summary = {
      totalModules: tenantModules.length,
      enabledModules: tenantModules.length,
      coreModules: 0,
      businessModules: 0,
      integrationModules: 0,
      analyticsModules: 0,
      modulesByPricing: {} as Record<string, number>,
    };

    tenantModules.forEach(tm => {
      if (tm.moduleRegistry) {
        // Count by category
        switch (tm.moduleRegistry.category) {
          case 'core':
            summary.coreModules++;
            break;
          case 'business':
            summary.businessModules++;
            break;
          case 'integration':
            summary.integrationModules++;
            break;
          case 'analytics':
            summary.analyticsModules++;
            break;
        }

        // Count by pricing model
        const pricingModel = tm.moduleRegistry.pricingModel || 'free';
        summary.modulesByPricing[pricingModel] = (summary.modulesByPricing[pricingModel] || 0) + 1;
      }
    });

    return summary;
  }

  /**
   * Bulk enable modules for a tenant
   */
  async bulkEnableModules(
    tenantId: string,
    moduleNames: string[],
    userId: string,
  ): Promise<{
    successful: string[];
    failed: Record<string, string>;
  }> {
    this.logger.log(`Bulk enabling modules for tenant ${tenantId}: ${moduleNames.join(', ')}`);

    const result = {
      successful: [] as string[],
      failed: {} as Record<string, string>,
    };

    for (const moduleName of moduleNames) {
      try {
        await this.enableModule(tenantId, { moduleName }, userId);
        result.successful.push(moduleName);
      } catch (error) {
        result.failed[moduleName] = error.message;
      }
    }

    return result;
  }

  /**
   * Bulk disable modules for a tenant
   */
  async bulkDisableModules(
    tenantId: string,
    moduleNames: string[],
    userId: string,
  ): Promise<{
    successful: string[];
    failed: Record<string, string>;
  }> {
    this.logger.log(`Bulk disabling modules for tenant ${tenantId}: ${moduleNames.join(', ')}`);

    const result = {
      successful: [] as string[],
      failed: {} as Record<string, string>,
    };

    for (const moduleName of moduleNames) {
      try {
        await this.disableModule(tenantId, moduleName, userId);
        result.successful.push(moduleName);
      } catch (error) {
        result.failed[moduleName] = error.message;
      }
    }

    return result;
  }

  /**
   * Private helper methods
   */

  private async enableDependencies(
    tenantId: string,
    dependencies: string[],
    userId: string,
  ): Promise<void> {
    for (const dep of dependencies) {
      const hasAccess = await this.hasModuleAccess(tenantId, dep);
      if (!hasAccess) {
        this.logger.log(`Auto-enabling dependency ${dep} for tenant ${tenantId}`);
        await this.enableModule(tenantId, { moduleName: dep }, userId);
      }
    }
  }

  private async checkDependentModules(
    tenantId: string,
    moduleName: string,
  ): Promise<void> {
    // Find modules that depend on this one
    const dependentModules = await this.moduleRepository
      .createQueryBuilder('module')
      .where('module.dependencies @> :moduleName', {
        moduleName: JSON.stringify([moduleName])
      })
      .andWhere('module.isActive = :isActive', { isActive: true })
      .getMany();

    // Check which of these are enabled for this tenant
    const enabledDependents = [];
    for (const module of dependentModules) {
      const hasAccess = await this.hasModuleAccess(tenantId, module.name);
      if (hasAccess) {
        enabledDependents.push(module.name);
      }
    }

    if (enabledDependents.length > 0) {
      throw new BadRequestException(
        `Cannot disable '${moduleName}'. Required by enabled modules: ${enabledDependents.join(', ')}`
      );
    }
  }

  private async clearTenantModuleCache(tenantId: string): Promise<void> {
    const patterns = [
      `tenant:${tenantId}:*`,
    ];

    for (const pattern of patterns) {
      await this.cacheService.delPattern(pattern);
    }
  }
}