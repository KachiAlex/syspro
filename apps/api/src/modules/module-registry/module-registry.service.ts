import { Injectable, BadRequestException, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ModuleRegistry, ModuleCategory, PricingModel } from '@syspro/database';
import { CreateModuleDto, UpdateModuleDto } from './dto/module-registry.dto';
import { CacheService } from '../../shared/services/cache.service';

@Injectable()
export class ModuleRegistryService {
  private readonly logger = new Logger(ModuleRegistryService.name);

  constructor(
    @InjectRepository(ModuleRegistry)
    private moduleRepository: Repository<ModuleRegistry>,
    private cacheService: CacheService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Register a new module in the system
   */
  async registerModule(moduleData: CreateModuleDto): Promise<ModuleRegistry> {
    this.logger.log(`Registering new module: ${moduleData.name}`);

    // Validate dependencies exist
    await this.validateDependencies(moduleData.dependencies || []);
    await this.validateDependencies(moduleData.optionalDependencies || []);

    // Check if module already exists
    const existingModule = await this.moduleRepository.findOne({
      where: { name: moduleData.name }
    });

    if (existingModule) {
      throw new ConflictException(`Module with name '${moduleData.name}' already exists`);
    }

    // Validate configuration schema
    this.validateConfigurationSchema(moduleData.configurationSchema);

    // Create module
    const module = this.moduleRepository.create({
      ...moduleData,
      dependencies: moduleData.dependencies || [],
      optionalDependencies: moduleData.optionalDependencies || [],
      configurationSchema: moduleData.configurationSchema || {},
      featureFlags: moduleData.featureFlags || {},
      apiEndpoints: moduleData.apiEndpoints || [],
    });

    const savedModule = await this.moduleRepository.save(module);

    // Clear cache
    await this.clearModuleCache();

    // Emit event
    this.eventEmitter.emit('module.registered', {
      module: savedModule,
      timestamp: new Date(),
    });

    this.logger.log(`Module registered successfully: ${savedModule.name}`);
    return savedModule;
  }

  /**
   * Update an existing module
   */
  async updateModule(name: string, updateData: UpdateModuleDto): Promise<ModuleRegistry> {
    this.logger.log(`Updating module: ${name}`);

    const module = await this.moduleRepository.findOne({
      where: { name }
    });

    if (!module) {
      throw new NotFoundException(`Module '${name}' not found`);
    }

    // Validate dependencies if provided
    if (updateData.dependencies) {
      await this.validateDependencies(updateData.dependencies);
    }
    if (updateData.optionalDependencies) {
      await this.validateDependencies(updateData.optionalDependencies);
    }

    // Validate configuration schema if provided
    if (updateData.configurationSchema) {
      this.validateConfigurationSchema(updateData.configurationSchema);
    }

    // Update module
    Object.assign(module, updateData);
    const savedModule = await this.moduleRepository.save(module);

    // Clear cache
    await this.clearModuleCache();

    // Emit event
    this.eventEmitter.emit('module.updated', {
      module: savedModule,
      timestamp: new Date(),
    });

    this.logger.log(`Module updated successfully: ${savedModule.name}`);
    return savedModule;
  }

  /**
   * Get all active modules
   */
  async getAllModules(): Promise<ModuleRegistry[]> {
    const cacheKey = 'modules:all';
    let modules = await this.cacheService.get<ModuleRegistry[]>(cacheKey);

    if (!modules) {
      modules = await this.moduleRepository.find({
        where: { isActive: true },
        order: { category: 'ASC', name: 'ASC' }
      });
      await this.cacheService.set(cacheKey, modules, 300); // 5 minutes
    }

    return modules;
  }

  /**
   * Get modules by category
   */
  async getModulesByCategory(category: ModuleCategory): Promise<ModuleRegistry[]> {
    const cacheKey = `modules:category:${category}`;
    let modules = await this.cacheService.get<ModuleRegistry[]>(cacheKey);

    if (!modules) {
      modules = await this.moduleRepository.find({
        where: { category, isActive: true },
        order: { name: 'ASC' }
      });
      await this.cacheService.set(cacheKey, modules, 300);
    }

    return modules;
  }

  /**
   * Get a specific module by name
   */
  async getModuleByName(name: string): Promise<ModuleRegistry | null> {
    const cacheKey = `module:${name}`;
    let module = await this.cacheService.get<ModuleRegistry>(cacheKey);

    if (!module) {
      module = await this.moduleRepository.findOne({
        where: { name, isActive: true }
      });
      if (module) {
        await this.cacheService.set(cacheKey, module, 300);
      }
    }

    return module;
  }

  /**
   * Get core modules (cannot be disabled)
   */
  async getCoreModules(): Promise<ModuleRegistry[]> {
    const cacheKey = 'modules:core';
    let modules = await this.cacheService.get<ModuleRegistry[]>(cacheKey);

    if (!modules) {
      modules = await this.moduleRepository.find({
        where: { isCore: true, isActive: true },
        order: { name: 'ASC' }
      });
      await this.cacheService.set(cacheKey, modules, 600); // 10 minutes (core modules change rarely)
    }

    return modules;
  }

  /**
   * Get modules with specific pricing model
   */
  async getModulesByPricingModel(pricingModel: PricingModel): Promise<ModuleRegistry[]> {
    return this.moduleRepository.find({
      where: { pricingModel, isActive: true },
      order: { name: 'ASC' }
    });
  }

  /**
   * Activate/deactivate a module
   */
  async setModuleStatus(name: string, isActive: boolean): Promise<ModuleRegistry> {
    this.logger.log(`Setting module ${name} status to: ${isActive ? 'active' : 'inactive'}`);

    const module = await this.moduleRepository.findOne({
      where: { name }
    });

    if (!module) {
      throw new NotFoundException(`Module '${name}' not found`);
    }

    if (module.isCore && !isActive) {
      throw new BadRequestException('Cannot deactivate core modules');
    }

    module.isActive = isActive;
    const savedModule = await this.moduleRepository.save(module);

    // Clear cache
    await this.clearModuleCache();

    // Emit event
    this.eventEmitter.emit(isActive ? 'module.activated' : 'module.deactivated', {
      module: savedModule,
      timestamp: new Date(),
    });

    return savedModule;
  }

  /**
   * Delete a module (soft delete by deactivating)
   */
  async deleteModule(name: string): Promise<void> {
    this.logger.log(`Deleting module: ${name}`);

    const module = await this.moduleRepository.findOne({
      where: { name }
    });

    if (!module) {
      throw new NotFoundException(`Module '${name}' not found`);
    }

    if (module.isCore) {
      throw new BadRequestException('Cannot delete core modules');
    }

    // Check if any modules depend on this one
    const dependentModules = await this.moduleRepository
      .createQueryBuilder('module')
      .where('module.dependencies @> :moduleName', {
        moduleName: JSON.stringify([name])
      })
      .andWhere('module.isActive = :isActive', { isActive: true })
      .getMany();

    if (dependentModules.length > 0) {
      const dependentNames = dependentModules.map(m => m.name).join(', ');
      throw new BadRequestException(
        `Cannot delete module '${name}'. Required by: ${dependentNames}`
      );
    }

    // Soft delete by deactivating
    await this.setModuleStatus(name, false);

    this.logger.log(`Module deleted successfully: ${name}`);
  }

  /**
   * Get module dependency tree
   */
  async getModuleDependencyTree(name: string): Promise<{
    module: ModuleRegistry;
    dependencies: ModuleRegistry[];
    optionalDependencies: ModuleRegistry[];
    dependents: ModuleRegistry[];
  }> {
    const module = await this.getModuleByName(name);
    if (!module) {
      throw new NotFoundException(`Module '${name}' not found`);
    }

    // Get dependencies
    const dependencies = await this.moduleRepository.find({
      where: { name: In(module.dependencies), isActive: true }
    });

    // Get optional dependencies
    const optionalDependencies = await this.moduleRepository.find({
      where: { name: In(module.optionalDependencies), isActive: true }
    });

    // Get dependents (modules that depend on this one)
    const dependents = await this.moduleRepository
      .createQueryBuilder('module')
      .where('module.dependencies @> :moduleName', {
        moduleName: JSON.stringify([name])
      })
      .andWhere('module.isActive = :isActive', { isActive: true })
      .getMany();

    return {
      module,
      dependencies,
      optionalDependencies,
      dependents,
    };
  }

  /**
   * Validate module compatibility
   */
  async validateModuleCompatibility(modules: string[]): Promise<{
    isCompatible: boolean;
    conflicts: string[];
    missingDependencies: string[];
  }> {
    const conflicts: string[] = [];
    const missingDependencies: string[] = [];

    // Get all modules
    const moduleEntities = await this.moduleRepository.find({
      where: { name: In(modules), isActive: true }
    });

    // Check if all modules exist
    const foundModuleNames = moduleEntities.map(m => m.name);
    const notFound = modules.filter(name => !foundModuleNames.includes(name));
    if (notFound.length > 0) {
      conflicts.push(`Modules not found: ${notFound.join(', ')}`);
    }

    // Check dependencies
    for (const module of moduleEntities) {
      for (const dep of module.dependencies) {
        if (!modules.includes(dep)) {
          missingDependencies.push(`${module.name} requires ${dep}`);
        }
      }
    }

    // TODO: Add more sophisticated compatibility checks
    // - Version compatibility
    // - Conflicting modules
    // - Resource conflicts

    return {
      isCompatible: conflicts.length === 0 && missingDependencies.length === 0,
      conflicts,
      missingDependencies,
    };
  }

  /**
   * Get module statistics
   */
  async getModuleStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    core: number;
    byCategory: Record<ModuleCategory, number>;
    byPricingModel: Record<PricingModel, number>;
  }> {
    const [total, active, core] = await Promise.all([
      this.moduleRepository.count(),
      this.moduleRepository.count({ where: { isActive: true } }),
      this.moduleRepository.count({ where: { isCore: true, isActive: true } }),
    ]);

    // Get counts by category
    const categoryStats = await this.moduleRepository
      .createQueryBuilder('module')
      .select('module.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('module.isActive = :isActive', { isActive: true })
      .groupBy('module.category')
      .getRawMany();

    const byCategory = Object.values(ModuleCategory).reduce((acc, category) => {
      acc[category] = 0;
      return acc;
    }, {} as Record<ModuleCategory, number>);

    categoryStats.forEach(stat => {
      byCategory[stat.category as ModuleCategory] = parseInt(stat.count);
    });

    // Get counts by pricing model
    const pricingStats = await this.moduleRepository
      .createQueryBuilder('module')
      .select('module.pricingModel', 'pricingModel')
      .addSelect('COUNT(*)', 'count')
      .where('module.isActive = :isActive', { isActive: true })
      .andWhere('module.pricingModel IS NOT NULL')
      .groupBy('module.pricingModel')
      .getRawMany();

    const byPricingModel = Object.values(PricingModel).reduce((acc, model) => {
      acc[model] = 0;
      return acc;
    }, {} as Record<PricingModel, number>);

    pricingStats.forEach(stat => {
      byPricingModel[stat.pricingModel as PricingModel] = parseInt(stat.count);
    });

    return {
      total,
      active,
      inactive: total - active,
      core,
      byCategory,
      byPricingModel,
    };
  }

  /**
   * Private helper methods
   */

  private async validateDependencies(dependencies: string[]): Promise<void> {
    if (!dependencies?.length) return;

    const existingModules = await this.moduleRepository.find({
      where: { name: In(dependencies), isActive: true }
    });

    const missingDeps = dependencies.filter(
      dep => !existingModules.find(m => m.name === dep)
    );

    if (missingDeps.length > 0) {
      throw new BadRequestException(
        `Missing dependencies: ${missingDeps.join(', ')}`
      );
    }
  }

  private validateConfigurationSchema(schema: Record<string, any>): void {
    if (!schema || typeof schema !== 'object') return;

    // Basic JSON schema validation
    // In a real implementation, use a proper JSON schema validator like ajv
    if (schema.type && !['object', 'array', 'string', 'number', 'boolean'].includes(schema.type)) {
      throw new BadRequestException('Invalid configuration schema type');
    }

    // Validate properties if it's an object schema
    if (schema.type === 'object' && schema.properties) {
      if (typeof schema.properties !== 'object') {
        throw new BadRequestException('Configuration schema properties must be an object');
      }
    }
  }

  private async clearModuleCache(): Promise<void> {
    const patterns = [
      'modules:*',
      'module:*',
    ];

    for (const pattern of patterns) {
      await this.cacheService.delPattern(pattern);
    }
  }
}