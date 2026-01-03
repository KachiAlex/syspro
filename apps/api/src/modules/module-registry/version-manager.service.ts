import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModuleRegistry, TenantModule } from '@syspro/database';
import { CacheService } from '../../shared/services/cache.service';

interface VersionCompatibility {
  version: string;
  compatibleWith: string[];
  incompatibleWith: string[];
  deprecated: boolean;
  deprecationDate?: Date;
  migrationPath?: string;
}

interface VersionUpgradeResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  migrationRequired: boolean;
  migrationSteps?: string[];
  warnings?: string[];
}

@Injectable()
export class VersionManagerService {
  private readonly logger = new Logger(VersionManagerService.name);

  constructor(
    @InjectRepository(ModuleRegistry)
    private moduleRepository: Repository<ModuleRegistry>,
    @InjectRepository(TenantModule)
    private tenantModuleRepository: Repository<TenantModule>,
    private cacheService: CacheService,
  ) {}

  /**
   * Get all available versions for a module
   */
  async getModuleVersions(moduleName: string): Promise<ModuleRegistry[]> {
    const cacheKey = `module:${moduleName}:versions`;
    let versions = await this.cacheService.get<ModuleRegistry[]>(cacheKey);

    if (!versions) {
      versions = await this.moduleRepository.find({
        where: { name: moduleName, isActive: true },
        order: { version: 'DESC' }
      });
      await this.cacheService.set(cacheKey, versions, 600); // 10 minutes
    }

    return versions;
  }

  /**
   * Get the latest version of a module
   */
  async getLatestVersion(moduleName: string): Promise<ModuleRegistry | null> {
    const versions = await this.getModuleVersions(moduleName);
    return versions.length > 0 ? versions[0] : null;
  }

  /**
   * Get the latest compatible version for a module
   */
  async getLatestCompatibleVersion(
    moduleName: string,
    currentVersion?: string,
  ): Promise<ModuleRegistry | null> {
    const versions = await this.getModuleVersions(moduleName);
    
    if (!currentVersion) {
      return versions.length > 0 ? versions[0] : null;
    }

    // Find the latest version that's compatible with the current version
    for (const version of versions) {
      if (this.isVersionCompatible(currentVersion, version.version)) {
        return version;
      }
    }

    return null;
  }

  /**
   * Check if two versions are compatible
   */
  isVersionCompatible(version1: string, version2: string): boolean {
    const v1 = this.parseVersion(version1);
    const v2 = this.parseVersion(version2);

    // Same major version is generally compatible
    if (v1.major === v2.major) {
      return true;
    }

    // Major version differences require explicit compatibility checking
    // For now, we'll be conservative and say they're incompatible
    return false;
  }

  /**
   * Upgrade a tenant's module to a specific version
   */
  async upgradeModuleVersion(
    tenantId: string,
    moduleName: string,
    targetVersion: string,
    userId: string,
  ): Promise<VersionUpgradeResult> {
    this.logger.log(`Upgrading module ${moduleName} to version ${targetVersion} for tenant ${tenantId}`);

    // Get current tenant module
    const tenantModule = await this.tenantModuleRepository.findOne({
      where: { tenantId, moduleName, isEnabled: true }
    });

    if (!tenantModule) {
      throw new BadRequestException(`Module '${moduleName}' is not enabled for this tenant`);
    }

    const currentVersion = tenantModule.version;

    // Get target module version
    const targetModule = await this.moduleRepository.findOne({
      where: { name: moduleName, version: targetVersion, isActive: true }
    });

    if (!targetModule) {
      throw new BadRequestException(`Module version '${targetVersion}' not found or inactive`);
    }

    // Check compatibility
    const isCompatible = this.isVersionCompatible(currentVersion, targetVersion);
    if (!isCompatible) {
      throw new BadRequestException(
        `Version ${targetVersion} is not compatible with current version ${currentVersion}`
      );
    }

    // Check if upgrade is valid (can't downgrade to older major versions)
    const isValidUpgrade = this.isValidUpgrade(currentVersion, targetVersion);
    if (!isValidUpgrade) {
      throw new BadRequestException(
        `Cannot upgrade from ${currentVersion} to ${targetVersion}. Invalid version transition.`
      );
    }

    // Perform the upgrade
    const migrationRequired = this.requiresMigration(currentVersion, targetVersion);
    const migrationSteps = migrationRequired ? this.getMigrationSteps(currentVersion, targetVersion) : [];
    const warnings = this.getUpgradeWarnings(currentVersion, targetVersion);

    // Update tenant module version
    tenantModule.version = targetVersion;
    
    // Merge configuration schema changes
    const updatedConfig = this.mergeConfiguration(
      tenantModule.configuration,
      targetModule.getDefaultConfiguration()
    );
    tenantModule.configuration = updatedConfig;

    // Merge feature flags
    const updatedFeatureFlags = this.mergeFeatureFlags(
      tenantModule.featureFlags,
      targetModule.getDefaultFeatureFlags()
    );
    tenantModule.featureFlags = updatedFeatureFlags;

    await this.tenantModuleRepository.save(tenantModule);

    // Clear cache
    await this.clearVersionCache(moduleName);

    const result: VersionUpgradeResult = {
      success: true,
      fromVersion: currentVersion,
      toVersion: targetVersion,
      migrationRequired,
      migrationSteps,
      warnings,
    };

    this.logger.log(`Module ${moduleName} upgraded successfully from ${currentVersion} to ${targetVersion}`);
    return result;
  }

  /**
   * Downgrade a tenant's module to a specific version
   */
  async downgradeModuleVersion(
    tenantId: string,
    moduleName: string,
    targetVersion: string,
    userId: string,
  ): Promise<VersionUpgradeResult> {
    this.logger.log(`Downgrading module ${moduleName} to version ${targetVersion} for tenant ${tenantId}`);

    // Get current tenant module
    const tenantModule = await this.tenantModuleRepository.findOne({
      where: { tenantId, moduleName, isEnabled: true }
    });

    if (!tenantModule) {
      throw new BadRequestException(`Module '${moduleName}' is not enabled for this tenant`);
    }

    const currentVersion = tenantModule.version;

    // Get target module version
    const targetModule = await this.moduleRepository.findOne({
      where: { name: moduleName, version: targetVersion, isActive: true }
    });

    if (!targetModule) {
      throw new BadRequestException(`Module version '${targetVersion}' not found or inactive`);
    }

    // Check if downgrade is valid
    const isValidDowngrade = this.isValidDowngrade(currentVersion, targetVersion);
    if (!isValidDowngrade) {
      throw new BadRequestException(
        `Cannot downgrade from ${currentVersion} to ${targetVersion}. Invalid version transition.`
      );
    }

    // Perform the downgrade
    const migrationRequired = this.requiresMigration(currentVersion, targetVersion);
    const migrationSteps = migrationRequired ? this.getMigrationSteps(currentVersion, targetVersion) : [];
    const warnings = this.getDowngradeWarnings(currentVersion, targetVersion);

    // Update tenant module version
    tenantModule.version = targetVersion;
    
    // Handle configuration compatibility (remove unsupported fields)
    const compatibleConfig = this.makeConfigurationCompatible(
      tenantModule.configuration,
      targetModule.configurationSchema
    );
    tenantModule.configuration = compatibleConfig;

    // Handle feature flag compatibility
    const compatibleFeatureFlags = this.makeFeatureFlagsCompatible(
      tenantModule.featureFlags,
      targetModule.featureFlags
    );
    tenantModule.featureFlags = compatibleFeatureFlags;

    await this.tenantModuleRepository.save(tenantModule);

    // Clear cache
    await this.clearVersionCache(moduleName);

    const result: VersionUpgradeResult = {
      success: true,
      fromVersion: currentVersion,
      toVersion: targetVersion,
      migrationRequired,
      migrationSteps,
      warnings,
    };

    this.logger.log(`Module ${moduleName} downgraded successfully from ${currentVersion} to ${targetVersion}`);
    return result;
  }

  /**
   * Get version compatibility matrix for a module
   */
  async getVersionCompatibilityMatrix(moduleName: string): Promise<VersionCompatibility[]> {
    const versions = await this.getModuleVersions(moduleName);
    
    return versions.map(version => ({
      version: version.version,
      compatibleWith: this.getCompatibleVersions(version.version, versions),
      incompatibleWith: this.getIncompatibleVersions(version.version, versions),
      deprecated: this.isVersionDeprecated(version.version),
      deprecationDate: this.getDeprecationDate(version.version),
      migrationPath: this.getMigrationPath(version.version),
    }));
  }

  /**
   * Get deprecated versions for a module
   */
  async getDeprecatedVersions(moduleName: string): Promise<ModuleRegistry[]> {
    const versions = await this.getModuleVersions(moduleName);
    return versions.filter(version => this.isVersionDeprecated(version.version));
  }

  /**
   * Check if a version requires migration
   */
  requiresMigration(fromVersion: string, toVersion: string): boolean {
    const from = this.parseVersion(fromVersion);
    const to = this.parseVersion(toVersion);

    // Major version changes typically require migration
    return from.major !== to.major;
  }

  /**
   * Private helper methods
   */

  private parseVersion(version: string): { major: number; minor: number; patch: number } {
    const parts = version.split('.').map(Number);
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0,
    };
  }

  private isValidUpgrade(fromVersion: string, toVersion: string): boolean {
    const from = this.parseVersion(fromVersion);
    const to = this.parseVersion(toVersion);

    // Can upgrade to same or higher version
    if (to.major > from.major) return true;
    if (to.major === from.major && to.minor > from.minor) return true;
    if (to.major === from.major && to.minor === from.minor && to.patch > from.patch) return true;

    return false;
  }

  private isValidDowngrade(fromVersion: string, toVersion: string): boolean {
    const from = this.parseVersion(fromVersion);
    const to = this.parseVersion(toVersion);

    // Can downgrade within same major version
    if (from.major === to.major) {
      if (to.minor < from.minor) return true;
      if (to.minor === from.minor && to.patch < from.patch) return true;
    }

    return false;
  }

  private getMigrationSteps(fromVersion: string, toVersion: string): string[] {
    // This would typically be loaded from a migration configuration
    return [
      `Backup current configuration for version ${fromVersion}`,
      `Apply schema changes for version ${toVersion}`,
      `Migrate data structures if needed`,
      `Update feature flag mappings`,
      `Validate configuration compatibility`,
    ];
  }

  private getUpgradeWarnings(fromVersion: string, toVersion: string): string[] {
    const warnings: string[] = [];
    const from = this.parseVersion(fromVersion);
    const to = this.parseVersion(toVersion);

    if (to.major > from.major) {
      warnings.push('Major version upgrade may introduce breaking changes');
    }

    if (this.requiresMigration(fromVersion, toVersion)) {
      warnings.push('This upgrade requires data migration');
    }

    return warnings;
  }

  private getDowngradeWarnings(fromVersion: string, toVersion: string): string[] {
    const warnings: string[] = [];
    
    warnings.push('Downgrading may result in loss of newer features');
    warnings.push('Some configuration options may be removed');
    
    if (this.requiresMigration(fromVersion, toVersion)) {
      warnings.push('This downgrade requires data migration');
    }

    return warnings;
  }

  private mergeConfiguration(
    currentConfig: Record<string, any>,
    defaultConfig: Record<string, any>
  ): Record<string, any> {
    // Merge configurations, keeping current values where possible
    return { ...defaultConfig, ...currentConfig };
  }

  private mergeFeatureFlags(
    currentFlags: Record<string, boolean>,
    defaultFlags: Record<string, boolean>
  ): Record<string, boolean> {
    // Merge feature flags, keeping current values where possible
    return { ...defaultFlags, ...currentFlags };
  }

  private makeConfigurationCompatible(
    config: Record<string, any>,
    schema: Record<string, any>
  ): Record<string, any> {
    if (!schema?.properties) return config;

    const compatibleConfig: Record<string, any> = {};
    
    // Only keep configuration keys that exist in the target schema
    Object.keys(config).forEach(key => {
      if (schema.properties[key]) {
        compatibleConfig[key] = config[key];
      }
    });

    return compatibleConfig;
  }

  private makeFeatureFlagsCompatible(
    flags: Record<string, boolean>,
    availableFlags: Record<string, any>
  ): Record<string, boolean> {
    const compatibleFlags: Record<string, boolean> = {};
    
    // Only keep feature flags that exist in the target version
    Object.keys(flags).forEach(key => {
      if (availableFlags[key]) {
        compatibleFlags[key] = flags[key];
      }
    });

    return compatibleFlags;
  }

  private getCompatibleVersions(version: string, allVersions: ModuleRegistry[]): string[] {
    return allVersions
      .filter(v => this.isVersionCompatible(version, v.version))
      .map(v => v.version);
  }

  private getIncompatibleVersions(version: string, allVersions: ModuleRegistry[]): string[] {
    return allVersions
      .filter(v => !this.isVersionCompatible(version, v.version))
      .map(v => v.version);
  }

  private isVersionDeprecated(version: string): boolean {
    // This would typically be loaded from configuration
    // For now, consider versions older than 1.0.0 as deprecated
    const parsed = this.parseVersion(version);
    return parsed.major === 0;
  }

  private getDeprecationDate(version: string): Date | undefined {
    // This would typically be loaded from configuration
    if (this.isVersionDeprecated(version)) {
      return new Date('2024-12-31'); // Example deprecation date
    }
    return undefined;
  }

  private getMigrationPath(version: string): string | undefined {
    // This would typically be loaded from configuration
    if (this.isVersionDeprecated(version)) {
      return 'Upgrade to version 1.0.0 or higher';
    }
    return undefined;
  }

  private async clearVersionCache(moduleName: string): Promise<void> {
    const patterns = [
      `module:${moduleName}:versions`,
      `module:${moduleName}:*`,
    ];

    for (const pattern of patterns) {
      await this.cacheService.delPattern(pattern);
    }
  }
}