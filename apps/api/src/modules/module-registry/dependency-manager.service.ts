import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModuleRegistry, TenantModule } from '@syspro/database';
import { CacheService } from '../../shared/services/cache.service';
import {
  DependencyActionDto,
  DependencyActionType,
  DependencyConflictDto,
  ConflictType,
  DependencyResolutionDto,
  DependencyNodeDto,
  EnhancedFunctionalityDto,
  DependencyPlanResultDto,
} from './dto/dependency-management.dto';

interface DependencyNode {
  moduleName: string;
  version: string;
  dependsOn: DependencyNode[];
  optionalDependencies: DependencyNode[];
  dependents: DependencyNode[];
}

interface DependencyConflict {
  type: ConflictType;
  description: string;
  affectedModules: string[];
  suggestions: string[];
}

interface DependencyResolution {
  canProceed: boolean;
  requiredActions: DependencyActionDto[];
  optionalActions: DependencyActionDto[];
  conflicts: DependencyConflictDto[];
  warnings: string[];
}

interface DependencyAction {
  action: DependencyActionType;
  moduleName: string;
  fromVersion?: string;
  toVersion?: string;
  reason: string;
  isOptional: boolean;
}

interface EnhancedFunctionality {
  moduleName: string;
  feature: string;
  description: string;
  enabledBy: string[]; // Optional dependencies that enable this feature
  requiredDependencies: string[];
}

@Injectable()
export class DependencyManagerService {
  private readonly logger = new Logger(DependencyManagerService.name);

  constructor(
    @InjectRepository(ModuleRegistry)
    private moduleRepository: Repository<ModuleRegistry>,
    @InjectRepository(TenantModule)
    private tenantModuleRepository: Repository<TenantModule>,
    private cacheService: CacheService,
  ) {}

  /**
   * Analyze dependencies before enabling a module
   */
  async analyzeDependenciesForEnable(
    tenantId: string,
    moduleName: string,
    version?: string,
  ): Promise<DependencyResolutionDto> {
    this.logger.log(`Analyzing dependencies for enabling ${moduleName} for tenant ${tenantId}`);

    const module = await this.getModuleWithDependencies(moduleName, version);
    if (!module) {
      return {
        canProceed: false,
        requiredActions: [],
        optionalActions: [],
        conflicts: [{
          type: ConflictType.MISSING_DEPENDENCY,
          description: `Module '${moduleName}' not found`,
          affectedModules: [moduleName],
          suggestions: ['Check module name and version'],
        }],
        warnings: [],
      };
    }

    const currentlyEnabled = await this.getTenantEnabledModules(tenantId);
    const dependencyTree = await this.buildDependencyTree(module, currentlyEnabled);
    
    return this.resolveDependencies(dependencyTree, currentlyEnabled, 'enable');
  }

  /**
   * Analyze dependencies before disabling a module
   */
  async analyzeDependenciesForDisable(
    tenantId: string,
    moduleName: string,
  ): Promise<DependencyResolutionDto> {
    this.logger.log(`Analyzing dependencies for disabling ${moduleName} for tenant ${tenantId}`);

    const currentlyEnabled = await this.getTenantEnabledModules(tenantId);
    const moduleToDisable = currentlyEnabled.find(m => m.moduleName === moduleName);
    
    if (!moduleToDisable) {
      return {
        canProceed: false,
        requiredActions: [],
        optionalActions: [],
        conflicts: [{
          type: ConflictType.MISSING_DEPENDENCY,
          description: `Module '${moduleName}' is not enabled for this tenant`,
          affectedModules: [moduleName],
          suggestions: ['Module is already disabled'],
        }],
        warnings: [],
      };
    }

    // Find modules that depend on this one
    const dependents = await this.findDependentModules(moduleName, currentlyEnabled);
    
    if (dependents.length > 0) {
      return {
        canProceed: false,
        requiredActions: [],
        optionalActions: [],
        conflicts: [{
          type: ConflictType.MISSING_DEPENDENCY,
          description: `Cannot disable '${moduleName}' because other modules depend on it`,
          affectedModules: [moduleName, ...dependents.map(d => d.moduleName)],
          suggestions: [
            `Disable dependent modules first: ${dependents.map(d => d.moduleName).join(', ')}`,
            'Or use force disable to disable all dependent modules',
          ],
        }],
        warnings: [],
      };
    }

    return {
      canProceed: true,
      requiredActions: [{
        action: DependencyActionType.DISABLE,
        moduleName,
        reason: 'User requested disable',
        isOptional: false,
      }],
      optionalActions: [],
      conflicts: [],
      warnings: [],
    };
  }

  /**
   * Get enhanced functionality available when optional dependencies are present
   */
  async getEnhancedFunctionality(
    tenantId: string,
    moduleName: string,
  ): Promise<EnhancedFunctionalityDto[]> {
    const cacheKey = `enhanced:${tenantId}:${moduleName}`;
    let enhanced = await this.cacheService.get<EnhancedFunctionalityDto[]>(cacheKey);

    if (!enhanced) {
      const currentlyEnabled = await this.getTenantEnabledModules(tenantId);
      const enabledModuleNames = currentlyEnabled.map(m => m.moduleName);
      
      enhanced = await this.calculateEnhancedFunctionality(moduleName, enabledModuleNames);
      await this.cacheService.set(cacheKey, enhanced, 300); // 5 minutes
    }

    return enhanced;
  }

  /**
   * Get dependency chain for a module
   */
  async getDependencyChain(
    moduleName: string,
    version?: string,
  ): Promise<DependencyNodeDto> {
    const cacheKey = `deps:chain:${moduleName}:${version || 'latest'}`;
    let chain = await this.cacheService.get<DependencyNodeDto>(cacheKey);

    if (!chain) {
      const module = await this.getModuleWithDependencies(moduleName, version);
      if (!module) {
        throw new BadRequestException(`Module '${moduleName}' not found`);
      }

      chain = await this.buildDependencyNode(module);
      await this.cacheService.set(cacheKey, chain, 600); // 10 minutes
    }

    return chain;
  }

  /**
   * Detect and resolve dependency conflicts
   */
  async detectConflicts(
    tenantId: string,
    proposedChanges: DependencyActionDto[],
  ): Promise<DependencyConflictDto[]> {
    const conflicts: DependencyConflict[] = [];
    const currentlyEnabled = await this.getTenantEnabledModules(tenantId);

    // Simulate the changes
    const simulatedState = this.simulateChanges(currentlyEnabled, proposedChanges);

    // Check for circular dependencies
    const circularConflicts = await this.detectCircularDependencies(simulatedState);
    conflicts.push(...circularConflicts);

    // Check for version conflicts
    const versionConflicts = await this.detectVersionConflicts(simulatedState);
    conflicts.push(...versionConflicts);

    // Check for missing dependencies
    const missingConflicts = await this.detectMissingDependencies(simulatedState);
    conflicts.push(...missingConflicts);

    return conflicts;
  }

  /**
   * Get suggestions for resolving conflicts
   */
  async getResolutionSuggestions(
    conflicts: DependencyConflictDto[],
  ): Promise<DependencyActionDto[]> {
    const suggestions: DependencyAction[] = [];

    for (const conflict of conflicts) {
      switch (conflict.type) {
        case 'version_conflict':
          suggestions.push(...await this.suggestVersionResolution(conflict));
          break;
        case 'circular_dependency':
          suggestions.push(...await this.suggestCircularResolution(conflict));
          break;
        case 'missing_dependency':
          suggestions.push(...await this.suggestMissingResolution(conflict));
          break;
        case 'optional_conflict':
          suggestions.push(...await this.suggestOptionalResolution(conflict));
          break;
      }
    }

    return suggestions;
  }

  /**
   * Execute dependency resolution plan
   */
  async executeDependencyPlan(
    tenantId: string,
    actions: DependencyActionDto[],
    userId: string,
  ): Promise<DependencyPlanResultDto> {
    this.logger.log(`Executing dependency plan for tenant ${tenantId}: ${actions.length} actions`);

    const results: any[] = [];
    const errors: string[] = [];

    // Sort actions by priority (enable dependencies first, disable dependents last)
    const sortedActions = this.sortActionsByPriority(actions);

    for (const action of sortedActions) {
      try {
        const result = await this.executeAction(tenantId, action, userId);
        results.push(result);
      } catch (error) {
        const errorMessage = `Failed to ${action.action} ${action.moduleName}: ${error.message}`;
        errors.push(errorMessage);
        this.logger.error(errorMessage, error.stack);
        
        // If a required action fails, stop execution
        if (!action.isOptional) {
          break;
        }
      }
    }

    // Clear dependency cache
    await this.clearDependencyCache(tenantId);

    return {
      success: errors.length === 0,
      results,
      errors,
    };
  }

  /**
   * Private helper methods
   */

  private async getModuleWithDependencies(
    moduleName: string,
    version?: string,
  ): Promise<ModuleRegistry | null> {
    const where: any = { name: moduleName, isActive: true };
    if (version) {
      where.version = version;
    }

    return this.moduleRepository.findOne({
      where,
      order: version ? {} : { version: 'DESC' },
    });
  }

  private async getTenantEnabledModules(tenantId: string): Promise<TenantModule[]> {
    return this.tenantModuleRepository.find({
      where: { tenantId, isEnabled: true },
    });
  }

  private async buildDependencyTree(
    module: ModuleRegistry,
    currentlyEnabled: TenantModule[],
  ): Promise<DependencyNode> {
    const visited = new Set<string>();
    return this.buildDependencyNode(module, visited);
  }

  private async buildDependencyNode(
    module: ModuleRegistry,
    visited: Set<string> = new Set(),
  ): Promise<DependencyNode> {
    if (visited.has(module.name)) {
      // Circular dependency detected
      return {
        moduleName: module.name,
        version: module.version,
        dependsOn: [],
        optionalDependencies: [],
        dependents: [],
      };
    }

    visited.add(module.name);

    const node: DependencyNode = {
      moduleName: module.name,
      version: module.version,
      dependsOn: [],
      optionalDependencies: [],
      dependents: [],
    };

    // Build required dependencies
    if (module.dependencies && module.dependencies.length > 0) {
      for (const depName of module.dependencies) {
        const depModule = await this.getModuleWithDependencies(depName);
        if (depModule) {
          const depNode = await this.buildDependencyNode(depModule, new Set(visited));
          node.dependsOn.push(depNode);
        }
      }
    }

    // Build optional dependencies
    if (module.optionalDependencies && module.optionalDependencies.length > 0) {
      for (const optDepName of module.optionalDependencies) {
        const optDepModule = await this.getModuleWithDependencies(optDepName);
        if (optDepModule) {
          const optDepNode = await this.buildDependencyNode(optDepModule, new Set(visited));
          node.optionalDependencies.push(optDepNode);
        }
      }
    }

    return node;
  }

  private async findDependentModules(
    moduleName: string,
    currentlyEnabled: TenantModule[],
  ): Promise<TenantModule[]> {
    const dependents: TenantModule[] = [];

    for (const tenantModule of currentlyEnabled) {
      const module = await this.getModuleWithDependencies(tenantModule.moduleName);
      if (module && module.dependencies && module.dependencies.includes(moduleName)) {
        dependents.push(tenantModule);
      }
    }

    return dependents;
  }

  private resolveDependencies(
    dependencyTree: DependencyNode,
    currentlyEnabled: TenantModule[],
    operation: 'enable' | 'disable',
  ): DependencyResolutionDto {
    const requiredActions: DependencyActionDto[] = [];
    const optionalActions: DependencyActionDto[] = [];
    const conflicts: DependencyConflictDto[] = [];
    const warnings: string[] = [];

    const enabledModuleNames = currentlyEnabled.map(m => m.moduleName);

    // Check required dependencies
    this.checkRequiredDependencies(
      dependencyTree,
      enabledModuleNames,
      requiredActions,
      conflicts,
    );

    // Check optional dependencies
    this.checkOptionalDependencies(
      dependencyTree,
      enabledModuleNames,
      optionalActions,
      warnings,
    );

    return {
      canProceed: conflicts.length === 0,
      requiredActions,
      optionalActions,
      conflicts,
      warnings,
    };
  }

  private checkRequiredDependencies(
    node: DependencyNode,
    enabledModules: string[],
    actions: DependencyActionDto[],
    conflicts: DependencyConflictDto[],
  ): void {
    for (const dep of node.dependsOn) {
      if (!enabledModules.includes(dep.moduleName)) {
        actions.push({
          action: DependencyActionType.ENABLE,
          moduleName: dep.moduleName,
          toVersion: dep.version,
          reason: `Required dependency for ${node.moduleName}`,
          isOptional: false,
        });
      }

      // Recursively check dependencies
      this.checkRequiredDependencies(dep, enabledModules, actions, conflicts);
    }
  }

  private checkOptionalDependencies(
    node: DependencyNode,
    enabledModules: string[],
    actions: DependencyActionDto[],
    warnings: string[],
  ): void {
    for (const optDep of node.optionalDependencies) {
      if (!enabledModules.includes(optDep.moduleName)) {
        const enhancedFeatures = this.getEnhancedFeaturesForDependency(
          node.moduleName,
          optDep.moduleName,
        );

        actions.push({
          action: DependencyActionType.ENABLE,
          moduleName: optDep.moduleName,
          toVersion: optDep.version,
          reason: `Optional dependency that enables: ${enhancedFeatures.join(', ')}`,
          isOptional: true,
        });

        warnings.push(
          `Optional dependency '${optDep.moduleName}' can enhance ${node.moduleName} with: ${enhancedFeatures.join(', ')}`
        );
      }
    }
  }

  private getEnhancedFeaturesForDependency(
    moduleName: string,
    dependencyName: string,
  ): string[] {
    // This would typically be loaded from configuration or database
    const enhancementMap: Record<string, Record<string, string[]>> = {
      crm: {
        'email-marketing': ['Advanced email campaigns', 'Lead nurturing workflows'],
        'analytics': ['Advanced reporting', 'Predictive analytics'],
        'telephony': ['Click-to-call', 'Call logging', 'VoIP integration'],
      },
      hr: {
        'payroll': ['Automated payroll processing', 'Tax calculations'],
        'recruitment': ['Job posting', 'Applicant tracking'],
        'performance': ['Performance reviews', 'Goal tracking'],
      },
      inventory: {
        'barcode': ['Barcode scanning', 'Label printing'],
        'warehouse': ['Multi-location tracking', 'Pick/pack optimization'],
        'forecasting': ['Demand forecasting', 'Reorder point optimization'],
      },
    };

    return enhancementMap[moduleName]?.[dependencyName] || ['Enhanced functionality'];
  }

  private async calculateEnhancedFunctionality(
    moduleName: string,
    enabledModules: string[],
  ): Promise<EnhancedFunctionalityDto[]> {
    const enhanced: EnhancedFunctionalityDto[] = [];

    // This would typically be loaded from configuration
    const enhancementDefinitions: Record<string, EnhancedFunctionalityDto[]> = {
      crm: [
        {
          moduleName: 'crm',
          feature: 'Advanced Email Campaigns',
          description: 'Create sophisticated email marketing campaigns with automation',
          enabledBy: ['email-marketing'],
          requiredDependencies: [],
        },
        {
          moduleName: 'crm',
          feature: 'Predictive Lead Scoring',
          description: 'AI-powered lead scoring and conversion prediction',
          enabledBy: ['analytics', 'ai-engine'],
          requiredDependencies: [],
        },
        {
          moduleName: 'crm',
          feature: 'Integrated Telephony',
          description: 'Click-to-call and call logging directly from CRM',
          enabledBy: ['telephony'],
          requiredDependencies: [],
        },
      ],
      hr: [
        {
          moduleName: 'hr',
          feature: 'Automated Payroll',
          description: 'Fully automated payroll processing with tax calculations',
          enabledBy: ['payroll'],
          requiredDependencies: [],
        },
        {
          moduleName: 'hr',
          feature: 'Advanced Recruitment',
          description: 'Job posting and applicant tracking system',
          enabledBy: ['recruitment'],
          requiredDependencies: [],
        },
      ],
    };

    const moduleEnhancements = enhancementDefinitions[moduleName] || [];

    for (const enhancement of moduleEnhancements) {
      const hasAllOptionalDeps = enhancement.enabledBy.every(dep => 
        enabledModules.includes(dep)
      );

      if (hasAllOptionalDeps) {
        enhanced.push(enhancement);
      }
    }

    return enhanced;
  }

  private simulateChanges(
    currentState: TenantModule[],
    changes: DependencyActionDto[],
  ): TenantModule[] {
    const simulated = [...currentState];

    for (const change of changes) {
      switch (change.action) {
        case DependencyActionType.ENABLE:
          if (!simulated.find(m => m.moduleName === change.moduleName)) {
            simulated.push({
              moduleName: change.moduleName,
              version: change.toVersion || '1.0.0',
              isEnabled: true,
            } as TenantModule);
          }
          break;
        case DependencyActionType.DISABLE:
          const index = simulated.findIndex(m => m.moduleName === change.moduleName);
          if (index >= 0) {
            simulated.splice(index, 1);
          }
          break;
      }
    }

    return simulated;
  }

  private async detectCircularDependencies(
    modules: TenantModule[],
  ): Promise<DependencyConflictDto[]> {
    // Implementation for circular dependency detection
    return [];
  }

  private async detectVersionConflicts(
    modules: TenantModule[],
  ): Promise<DependencyConflictDto[]> {
    // Implementation for version conflict detection
    return [];
  }

  private async detectMissingDependencies(
    modules: TenantModule[],
  ): Promise<DependencyConflictDto[]> {
    // Implementation for missing dependency detection
    return [];
  }

  private async suggestVersionResolution(
    conflict: DependencyConflictDto,
  ): Promise<DependencyActionDto[]> {
    return [];
  }

  private async suggestCircularResolution(
    conflict: DependencyConflictDto,
  ): Promise<DependencyActionDto[]> {
    return [];
  }

  private async suggestMissingResolution(
    conflict: DependencyConflictDto,
  ): Promise<DependencyActionDto[]> {
    return [];
  }

  private async suggestOptionalResolution(
    conflict: DependencyConflictDto,
  ): Promise<DependencyActionDto[]> {
    return [];
  }

  private sortActionsByPriority(actions: DependencyActionDto[]): DependencyActionDto[] {
    // Sort so that enables come before disables, and required before optional
    return actions.sort((a, b) => {
      if (a.action === DependencyActionType.ENABLE && b.action === DependencyActionType.DISABLE) return -1;
      if (a.action === DependencyActionType.DISABLE && b.action === DependencyActionType.ENABLE) return 1;
      if (!a.isOptional && b.isOptional) return -1;
      if (a.isOptional && !b.isOptional) return 1;
      return 0;
    });
  }

  private async executeAction(
    tenantId: string,
    action: DependencyActionDto,
    userId: string,
  ): Promise<any> {
    // This would integrate with TenantModuleService to actually perform the actions
    this.logger.log(`Executing ${action.action} for ${action.moduleName}`);
    return { action: action.action, module: action.moduleName, success: true };
  }

  private async clearDependencyCache(tenantId: string): Promise<void> {
    const patterns = [
      `deps:*:${tenantId}:*`,
      `enhanced:${tenantId}:*`,
      `deps:chain:*`,
    ];

    for (const pattern of patterns) {
      await this.cacheService.delPattern(pattern);
    }
  }
}