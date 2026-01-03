import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModuleRegistry, TenantModule } from '@syspro/database';
import { CacheService } from '../../shared/services/cache.service';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

interface ConfigurationTemplate {
  name: string;
  description: string;
  category: string;
  configuration: Record<string, any>;
  featureFlags: Record<string, boolean>;
  applicableModules: string[];
}

interface ConfigurationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface ConfigurationAuditEntry {
  timestamp: Date;
  userId: string;
  action: 'update' | 'reset' | 'template_applied';
  field: string;
  oldValue: any;
  newValue: any;
  reason?: string;
}

@Injectable()
export class ConfigurationManagerService {
  private readonly logger = new Logger(ConfigurationManagerService.name);
  private readonly ajv: Ajv;

  constructor(
    @InjectRepository(ModuleRegistry)
    private moduleRepository: Repository<ModuleRegistry>,
    @InjectRepository(TenantModule)
    private tenantModuleRepository: Repository<TenantModule>,
    private cacheService: CacheService,
  ) {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
  }

  /**
   * Validate module configuration against schema
   */
  async validateConfiguration(
    moduleName: string,
    configuration: Record<string, any>,
    version?: string,
  ): Promise<ConfigurationValidationResult> {
    this.logger.log(`Validating configuration for module ${moduleName}`);

    // Get module schema
    const module = await this.getModuleWithSchema(moduleName, version);
    if (!module) {
      return {
        isValid: false,
        errors: [`Module '${moduleName}' not found`],
        warnings: [],
      };
    }

    const schema = module.configurationSchema;
    if (!schema) {
      return {
        isValid: true,
        errors: [],
        warnings: ['No configuration schema defined for this module'],
      };
    }

    // Validate using AJV
    const validate = this.ajv.compile(schema);
    const isValid = validate(configuration);

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!isValid && validate.errors) {
      for (const error of validate.errors) {
        const message = `${error.instancePath || 'root'}: ${error.message}`;
        errors.push(message);
      }
    }

    // Additional business logic validation
    const businessValidation = await this.validateBusinessRules(moduleName, configuration);
    errors.push(...businessValidation.errors);
    warnings.push(...businessValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get available configuration templates
   */
  async getConfigurationTemplates(
    moduleName?: string,
    category?: string,
  ): Promise<ConfigurationTemplate[]> {
    const cacheKey = `config:templates:${moduleName || 'all'}:${category || 'all'}`;
    let templates = await this.cacheService.get<ConfigurationTemplate[]>(cacheKey);

    if (!templates) {
      templates = await this.loadConfigurationTemplates();
      
      // Filter by module and category if specified
      if (moduleName) {
        templates = templates.filter(t => 
          t.applicableModules.includes(moduleName) || t.applicableModules.includes('*')
        );
      }
      
      if (category) {
        templates = templates.filter(t => t.category === category);
      }

      await this.cacheService.set(cacheKey, templates, 1800); // 30 minutes
    }

    return templates;
  }

  /**
   * Apply configuration template to tenant module
   */
  async applyConfigurationTemplate(
    tenantId: string,
    moduleName: string,
    templateName: string,
    userId: string,
    overrides?: Record<string, any>,
  ): Promise<TenantModule> {
    this.logger.log(`Applying template ${templateName} to module ${moduleName} for tenant ${tenantId}`);

    // Get tenant module
    const tenantModule = await this.tenantModuleRepository.findOne({
      where: { tenantId, moduleName, isEnabled: true }
    });

    if (!tenantModule) {
      throw new BadRequestException(`Module '${moduleName}' is not enabled for this tenant`);
    }

    // Get template
    const templates = await this.getConfigurationTemplates(moduleName);
    const template = templates.find(t => t.name === templateName);

    if (!template) {
      throw new BadRequestException(`Configuration template '${templateName}' not found`);
    }

    // Prepare new configuration
    let newConfiguration = { ...template.configuration };
    if (overrides) {
      newConfiguration = { ...newConfiguration, ...overrides };
    }

    // Validate new configuration
    const validation = await this.validateConfiguration(moduleName, newConfiguration);
    if (!validation.isValid) {
      throw new BadRequestException(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    // Create audit entries
    const auditEntries = this.createConfigurationAuditEntries(
      tenantModule.configuration,
      newConfiguration,
      userId,
      'template_applied',
      `Applied template: ${templateName}`,
    );

    // Update configuration
    const oldConfiguration = tenantModule.configuration;
    tenantModule.configuration = newConfiguration;
    
    // Apply template feature flags
    const oldFeatureFlags = tenantModule.featureFlags;
    tenantModule.featureFlags = { ...tenantModule.featureFlags, ...template.featureFlags };

    // Add feature flag audit entries
    const flagAuditEntries = this.createFeatureFlagAuditEntries(
      oldFeatureFlags,
      tenantModule.featureFlags,
      userId,
      'template_applied',
      `Applied template: ${templateName}`,
    );

    // Store audit trail
    const allAuditEntries = [...auditEntries, ...flagAuditEntries];
    tenantModule.auditTrail = [
      ...(tenantModule.auditTrail || []),
      ...allAuditEntries,
    ];

    await this.tenantModuleRepository.save(tenantModule);

    // Clear cache
    await this.clearConfigurationCache(tenantId, moduleName);

    this.logger.log(`Template ${templateName} applied successfully to module ${moduleName}`);
    return tenantModule;
  }

  /**
   * Update module configuration with validation and audit trail
   */
  async updateConfiguration(
    tenantId: string,
    moduleName: string,
    configurationUpdates: Record<string, any>,
    userId: string,
    reason?: string,
  ): Promise<TenantModule> {
    this.logger.log(`Updating configuration for module ${moduleName} for tenant ${tenantId}`);

    // Get tenant module
    const tenantModule = await this.tenantModuleRepository.findOne({
      where: { tenantId, moduleName, isEnabled: true }
    });

    if (!tenantModule) {
      throw new BadRequestException(`Module '${moduleName}' is not enabled for this tenant`);
    }

    // Merge with existing configuration
    const newConfiguration = { ...tenantModule.configuration, ...configurationUpdates };

    // Validate new configuration
    const validation = await this.validateConfiguration(moduleName, newConfiguration);
    if (!validation.isValid) {
      throw new BadRequestException(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    // Create audit entries
    const auditEntries = this.createConfigurationAuditEntries(
      tenantModule.configuration,
      newConfiguration,
      userId,
      'update',
      reason,
    );

    // Update configuration
    tenantModule.configuration = newConfiguration;
    tenantModule.auditTrail = [
      ...(tenantModule.auditTrail || []),
      ...auditEntries,
    ];

    await this.tenantModuleRepository.save(tenantModule);

    // Clear cache
    await this.clearConfigurationCache(tenantId, moduleName);

    this.logger.log(`Configuration updated successfully for module ${moduleName}`);
    return tenantModule;
  }

  /**
   * Reset configuration to module defaults
   */
  async resetConfiguration(
    tenantId: string,
    moduleName: string,
    userId: string,
    reason?: string,
  ): Promise<TenantModule> {
    this.logger.log(`Resetting configuration for module ${moduleName} for tenant ${tenantId}`);

    // Get tenant module and module registry
    const [tenantModule, module] = await Promise.all([
      this.tenantModuleRepository.findOne({
        where: { tenantId, moduleName, isEnabled: true }
      }),
      this.moduleRepository.findOne({
        where: { name: moduleName, isActive: true }
      }),
    ]);

    if (!tenantModule) {
      throw new BadRequestException(`Module '${moduleName}' is not enabled for this tenant`);
    }

    if (!module) {
      throw new BadRequestException(`Module '${moduleName}' not found`);
    }

    // Get default configuration
    const defaultConfiguration = module.getDefaultConfiguration();
    const defaultFeatureFlags = module.getDefaultFeatureFlags();

    // Create audit entries
    const configAuditEntries = this.createConfigurationAuditEntries(
      tenantModule.configuration,
      defaultConfiguration,
      userId,
      'reset',
      reason,
    );

    const flagAuditEntries = this.createFeatureFlagAuditEntries(
      tenantModule.featureFlags,
      defaultFeatureFlags,
      userId,
      'reset',
      reason,
    );

    // Reset to defaults
    tenantModule.configuration = defaultConfiguration;
    tenantModule.featureFlags = defaultFeatureFlags;
    tenantModule.auditTrail = [
      ...(tenantModule.auditTrail || []),
      ...configAuditEntries,
      ...flagAuditEntries,
    ];

    await this.tenantModuleRepository.save(tenantModule);

    // Clear cache
    await this.clearConfigurationCache(tenantId, moduleName);

    this.logger.log(`Configuration reset successfully for module ${moduleName}`);
    return tenantModule;
  }

  /**
   * Get configuration audit trail
   */
  async getConfigurationAuditTrail(
    tenantId: string,
    moduleName: string,
    limit: number = 50,
  ): Promise<ConfigurationAuditEntry[]> {
    const tenantModule = await this.tenantModuleRepository.findOne({
      where: { tenantId, moduleName, isEnabled: true }
    });

    if (!tenantModule || !tenantModule.auditTrail) {
      return [];
    }

    // Return most recent entries first
    return tenantModule.auditTrail
      .slice(-limit)
      .reverse();
  }

  /**
   * Private helper methods
   */

  private async getModuleWithSchema(
    moduleName: string,
    version?: string,
  ): Promise<ModuleRegistry | null> {
    const where: any = { name: moduleName, isActive: true };
    if (version) {
      where.version = version;
    }

    return this.moduleRepository.findOne({
      where,
      order: version ? {} : { version: 'DESC' }, // Get latest if no version specified
    });
  }

  private async validateBusinessRules(
    moduleName: string,
    configuration: Record<string, any>,
  ): Promise<{ errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Module-specific business rules
    switch (moduleName) {
      case 'crm':
        if (configuration.maxContacts && configuration.maxContacts > 100000) {
          warnings.push('Large contact limits may impact performance');
        }
        break;

      case 'hr':
        if (configuration.payrollEnabled && !configuration.taxSettings) {
          errors.push('Tax settings are required when payroll is enabled');
        }
        break;

      case 'inventory':
        if (configuration.trackingMethod === 'serial' && !configuration.serialNumberFormat) {
          errors.push('Serial number format is required for serial tracking');
        }
        break;

      // Add more module-specific rules as needed
    }

    return { errors, warnings };
  }

  private async loadConfigurationTemplates(): Promise<ConfigurationTemplate[]> {
    // In a real implementation, these would be loaded from a database or configuration files
    return [
      {
        name: 'small-business',
        description: 'Configuration optimized for small businesses',
        category: 'business-size',
        configuration: {
          maxUsers: 25,
          storageLimit: '10GB',
          reportRetention: 365,
          autoBackup: true,
        },
        featureFlags: {
          advancedReporting: false,
          apiAccess: false,
          customFields: true,
        },
        applicableModules: ['*'],
      },
      {
        name: 'enterprise',
        description: 'Configuration for enterprise organizations',
        category: 'business-size',
        configuration: {
          maxUsers: 1000,
          storageLimit: '1TB',
          reportRetention: 2555, // 7 years
          autoBackup: true,
          redundancy: true,
        },
        featureFlags: {
          advancedReporting: true,
          apiAccess: true,
          customFields: true,
          sso: true,
        },
        applicableModules: ['*'],
      },
      {
        name: 'crm-sales-focused',
        description: 'CRM configuration optimized for sales teams',
        category: 'functional',
        configuration: {
          leadScoringEnabled: true,
          salesPipelineStages: ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'],
          autoFollowUpDays: 7,
          opportunityWeighting: true,
        },
        featureFlags: {
          leadScoring: true,
          salesForecasting: true,
          territoryManagement: true,
          quoteGeneration: true,
        },
        applicableModules: ['crm'],
      },
      {
        name: 'hr-compliance-focused',
        description: 'HR configuration with emphasis on compliance',
        category: 'functional',
        configuration: {
          documentRetention: 2555, // 7 years
          auditTrailEnabled: true,
          complianceReporting: true,
          backgroundCheckIntegration: true,
        },
        featureFlags: {
          complianceReports: true,
          auditTrail: true,
          documentManagement: true,
          backgroundChecks: true,
        },
        applicableModules: ['hr'],
      },
    ];
  }

  private createConfigurationAuditEntries(
    oldConfig: Record<string, any>,
    newConfig: Record<string, any>,
    userId: string,
    action: 'update' | 'reset' | 'template_applied',
    reason?: string,
  ): ConfigurationAuditEntry[] {
    const entries: ConfigurationAuditEntry[] = [];
    const timestamp = new Date();

    // Find changed fields
    const allKeys = new Set([...Object.keys(oldConfig || {}), ...Object.keys(newConfig || {})]);

    for (const key of allKeys) {
      const oldValue = oldConfig?.[key];
      const newValue = newConfig?.[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        entries.push({
          timestamp,
          userId,
          action,
          field: key,
          oldValue,
          newValue,
          reason,
        });
      }
    }

    return entries;
  }

  private createFeatureFlagAuditEntries(
    oldFlags: Record<string, boolean>,
    newFlags: Record<string, boolean>,
    userId: string,
    action: 'update' | 'reset' | 'template_applied',
    reason?: string,
  ): ConfigurationAuditEntry[] {
    const entries: ConfigurationAuditEntry[] = [];
    const timestamp = new Date();

    // Find changed flags
    const allKeys = new Set([...Object.keys(oldFlags || {}), ...Object.keys(newFlags || {})]);

    for (const key of allKeys) {
      const oldValue = oldFlags?.[key];
      const newValue = newFlags?.[key];

      if (oldValue !== newValue) {
        entries.push({
          timestamp,
          userId,
          action,
          field: `featureFlag.${key}`,
          oldValue,
          newValue,
          reason,
        });
      }
    }

    return entries;
  }

  private async clearConfigurationCache(tenantId: string, moduleName: string): Promise<void> {
    const patterns = [
      `tenant:${tenantId}:module:${moduleName}:*`,
      `config:templates:${moduleName}:*`,
      `config:templates:all:*`,
    ];

    for (const pattern of patterns) {
      await this.cacheService.delPattern(pattern);
    }
  }
}