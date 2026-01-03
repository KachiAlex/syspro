import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TenantModuleService } from './tenant-module.service';
import { VersionManagerService } from './version-manager.service';
import { ConfigurationManagerService } from './configuration-manager.service';
import { DependencyManagerService } from './dependency-manager.service';
import { ModuleUsageAnalyticsService } from './module-usage-analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { TenantModule } from '@syspro/database';
import {
  EnableModuleDto,
  UpdateModuleConfigDto,
  ToggleFeatureFlagDto,
  BulkModuleOperationDto,
  BulkModuleOperationResultDto,
  TenantModuleUsageSummaryDto,
  TenantModuleListDto,
} from './dto/tenant-module.dto';
import {
  UpgradeModuleVersionDto,
  DowngradeModuleVersionDto,
  VersionUpgradeResultDto,
  VersionCompatibilityDto,
  ModuleVersionListDto,
} from './dto/version-management.dto';
import {
  UpdateConfigurationDto,
  ApplyTemplateDto,
  ResetConfigurationDto,
  ConfigurationValidationResultDto,
  ConfigurationTemplateDto,
  ConfigurationAuditEntryDto,
  ValidateConfigurationDto,
  GetTemplatesQueryDto,
  GetAuditTrailQueryDto,
} from './dto/configuration-management.dto';
import {
  DependencyResolutionDto,
  DependencyNodeDto,
  EnhancedFunctionalityDto,
  ExecuteDependencyPlanDto,
  DependencyPlanResultDto,
  AnalyzeDependenciesQueryDto,
} from './dto/dependency-management.dto';
import {
  UsageMetricsDto,
  ModuleAdoptionMetricsDto,
  PerformanceMetricsDto,
  FeatureFlagUsageDto,
  UsageReportDto,
  RealTimeStatsDto,
  GetUsageMetricsQueryDto,
  GenerateReportQueryDto,
  TrackEventDto,
  TrackFeatureFlagDto,
} from './dto/usage-analytics.dto';

@ApiTags('Tenant Modules')
@Controller('api/v1/tenant/modules')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth()
export class TenantModuleController {
  private readonly logger = new Logger(TenantModuleController.name);

  constructor(
    private readonly tenantModuleService: TenantModuleService,
    private readonly versionManagerService: VersionManagerService,
    private readonly configurationManagerService: ConfigurationManagerService,
    private readonly dependencyManagerService: DependencyManagerService,
    private readonly moduleUsageAnalyticsService: ModuleUsageAnalyticsService,
  ) {}

  @Post('enable')
  @Roles('tenant_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Enable a module for the current tenant' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Module enabled successfully',
    type: TenantModule,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid module or missing dependencies',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Module is already enabled',
  })
  async enableModule(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() enableModuleDto: EnableModuleDto,
  ): Promise<TenantModule> {
    this.logger.log(`Enabling module ${enableModuleDto.moduleName} for tenant ${tenantId}`);
    return this.tenantModuleService.enableModule(tenantId, enableModuleDto, user.id);
  }

  @Delete(':moduleName')
  @Roles('tenant_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Disable a module for the current tenant' })
  @ApiParam({ name: 'moduleName', description: 'Module name to disable' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Module disabled successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot disable core modules or modules with dependencies',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found or not enabled',
  })
  async disableModule(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('moduleName') moduleName: string,
  ): Promise<void> {
    this.logger.log(`Disabling module ${moduleName} for tenant ${tenantId}`);
    await this.tenantModuleService.disableModule(tenantId, moduleName, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all enabled modules for the current tenant' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of enabled modules',
    type: [TenantModuleListDto],
  })
  async getTenantModules(@CurrentTenant() tenantId: string): Promise<TenantModule[]> {
    return this.tenantModuleService.getTenantModules(tenantId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get module usage summary for the current tenant' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Module usage summary',
    type: TenantModuleUsageSummaryDto,
  })
  async getModuleUsageSummary(@CurrentTenant() tenantId: string): Promise<TenantModuleUsageSummaryDto> {
    return this.tenantModuleService.getModuleUsageSummary(tenantId);
  }

  @Get(':moduleName')
  @ApiOperation({ summary: 'Get a specific enabled module for the current tenant' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Module details',
    type: TenantModule,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found or not enabled',
  })
  async getTenantModule(
    @CurrentTenant() tenantId: string,
    @Param('moduleName') moduleName: string,
  ): Promise<TenantModule> {
    const tenantModule = await this.tenantModuleService.getTenantModule(tenantId, moduleName);
    if (!tenantModule) {
      throw new Error(`Module '${moduleName}' not found or not enabled for this tenant`);
    }
    return tenantModule;
  }

  @Get(':moduleName/access')
  @ApiOperation({ summary: 'Check if tenant has access to a specific module' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Access check result',
    schema: {
      type: 'object',
      properties: {
        hasAccess: { type: 'boolean' },
        moduleName: { type: 'string' },
      },
    },
  })
  async checkModuleAccess(
    @CurrentTenant() tenantId: string,
    @Param('moduleName') moduleName: string,
  ): Promise<{ hasAccess: boolean; moduleName: string }> {
    const hasAccess = await this.tenantModuleService.hasModuleAccess(tenantId, moduleName);
    return { hasAccess, moduleName };
  }

  @Put(':moduleName/configuration')
  @Roles('tenant_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Update module configuration for the current tenant' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Module configuration updated successfully',
    type: TenantModule,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid configuration',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found or not enabled',
  })
  async updateModuleConfiguration(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('moduleName') moduleName: string,
    @Body() updateDto: UpdateModuleConfigDto,
  ): Promise<TenantModule> {
    return this.tenantModuleService.updateModuleConfiguration(
      tenantId,
      moduleName,
      updateDto,
      user.id,
    );
  }

  @Patch(':moduleName/feature-flags')
  @Roles('tenant_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Toggle a feature flag for a module' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Feature flag toggled successfully',
    type: TenantModule,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found or not enabled',
  })
  async toggleFeatureFlag(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('moduleName') moduleName: string,
    @Body() toggleDto: ToggleFeatureFlagDto,
  ): Promise<TenantModule> {
    return this.tenantModuleService.toggleFeatureFlag(
      tenantId,
      moduleName,
      toggleDto.flagName,
      toggleDto.enabled,
      user.id,
    );
  }

  @Post('bulk-enable')
  @Roles('tenant_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Enable multiple modules for the current tenant' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk enable operation result',
    type: BulkModuleOperationResultDto,
  })
  async bulkEnableModules(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() bulkDto: BulkModuleOperationDto,
  ): Promise<BulkModuleOperationResultDto> {
    this.logger.log(`Bulk enabling modules for tenant ${tenantId}: ${bulkDto.moduleNames.join(', ')}`);
    return this.tenantModuleService.bulkEnableModules(tenantId, bulkDto.moduleNames, user.id);
  }

  @Post('bulk-disable')
  @Roles('tenant_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Disable multiple modules for the current tenant' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk disable operation result',
    type: BulkModuleOperationResultDto,
  })
  async bulkDisableModules(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() bulkDto: BulkModuleOperationDto,
  ): Promise<BulkModuleOperationResultDto> {
    this.logger.log(`Bulk disabling modules for tenant ${tenantId}: ${bulkDto.moduleNames.join(', ')}`);
    return this.tenantModuleService.bulkDisableModules(tenantId, bulkDto.moduleNames, user.id);
  }

  @Get(':moduleName/versions')
  @ApiOperation({ summary: 'Get all available versions for a module' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of available module versions',
    type: [ModuleVersionListDto],
  })
  async getModuleVersions(
    @Param('moduleName') moduleName: string,
  ): Promise<ModuleVersionListDto[]> {
    const versions = await this.versionManagerService.getModuleVersions(moduleName);
    const latest = await this.versionManagerService.getLatestVersion(moduleName);
    
    return versions.map(version => ({
      name: version.name,
      displayName: version.displayName,
      version: version.version,
      isLatest: latest?.version === version.version,
      isDeprecated: this.versionManagerService.isVersionCompatible('0.0.0', version.version) === false,
      category: version.category,
      description: version.description,
      createdAt: version.createdAt,
    }));
  }

  @Get(':moduleName/versions/compatibility')
  @ApiOperation({ summary: 'Get version compatibility matrix for a module' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Version compatibility matrix',
    type: [VersionCompatibilityDto],
  })
  async getVersionCompatibilityMatrix(
    @Param('moduleName') moduleName: string,
  ): Promise<VersionCompatibilityDto[]> {
    return this.versionManagerService.getVersionCompatibilityMatrix(moduleName);
  }

  @Post(':moduleName/upgrade')
  @Roles('tenant_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Upgrade a module to a specific version' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Module upgraded successfully',
    type: VersionUpgradeResultDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid version or upgrade not possible',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found or not enabled',
  })
  async upgradeModuleVersion(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('moduleName') moduleName: string,
    @Body() upgradeDto: UpgradeModuleVersionDto,
  ): Promise<VersionUpgradeResultDto> {
    this.logger.log(`Upgrading module ${moduleName} to version ${upgradeDto.targetVersion} for tenant ${tenantId}`);
    return this.versionManagerService.upgradeModuleVersion(
      tenantId,
      moduleName,
      upgradeDto.targetVersion,
      user.id,
    );
  }

  @Post(':moduleName/downgrade')
  @Roles('tenant_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Downgrade a module to a specific version' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Module downgraded successfully',
    type: VersionUpgradeResultDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid version or downgrade not possible',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found or not enabled',
  })
  async downgradeModuleVersion(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('moduleName') moduleName: string,
    @Body() downgradeDto: DowngradeModuleVersionDto,
  ): Promise<VersionUpgradeResultDto> {
    this.logger.log(`Downgrading module ${moduleName} to version ${downgradeDto.targetVersion} for tenant ${tenantId}`);
    return this.versionManagerService.downgradeModuleVersion(
      tenantId,
      moduleName,
      downgradeDto.targetVersion,
      user.id,
    );
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get available configuration templates' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of available configuration templates',
    type: [ConfigurationTemplateDto],
  })
  async getConfigurationTemplates(
    @Query() query: GetTemplatesQueryDto,
  ): Promise<ConfigurationTemplateDto[]> {
    return this.configurationManagerService.getConfigurationTemplates(undefined, query.category);
  }

  @Get(':moduleName/templates')
  @ApiOperation({ summary: 'Get configuration templates for a specific module' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of configuration templates for the module',
    type: [ConfigurationTemplateDto],
  })
  async getModuleConfigurationTemplates(
    @Param('moduleName') moduleName: string,
    @Query() query: GetTemplatesQueryDto,
  ): Promise<ConfigurationTemplateDto[]> {
    return this.configurationManagerService.getConfigurationTemplates(moduleName, query.category);
  }

  @Post(':moduleName/configuration/validate')
  @ApiOperation({ summary: 'Validate module configuration' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Configuration validation result',
    type: ConfigurationValidationResultDto,
  })
  async validateConfiguration(
    @Param('moduleName') moduleName: string,
    @Body() validateDto: ValidateConfigurationDto,
  ): Promise<ConfigurationValidationResultDto> {
    return this.configurationManagerService.validateConfiguration(
      moduleName,
      validateDto.configuration,
      validateDto.version,
    );
  }

  @Put(':moduleName/configuration/advanced')
  @Roles('tenant_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Update module configuration with advanced validation' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Module configuration updated successfully',
    type: TenantModule,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid configuration',
  })
  async updateAdvancedConfiguration(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('moduleName') moduleName: string,
    @Body() updateDto: UpdateConfigurationDto,
  ): Promise<TenantModule> {
    return this.configurationManagerService.updateConfiguration(
      tenantId,
      moduleName,
      updateDto.configuration,
      user.id,
      updateDto.reason,
    );
  }

  @Post(':moduleName/configuration/template')
  @Roles('tenant_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Apply a configuration template to the module' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Configuration template applied successfully',
    type: TenantModule,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid template or configuration',
  })
  async applyConfigurationTemplate(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('moduleName') moduleName: string,
    @Body() applyDto: ApplyTemplateDto,
  ): Promise<TenantModule> {
    return this.configurationManagerService.applyConfigurationTemplate(
      tenantId,
      moduleName,
      applyDto.templateName,
      user.id,
      applyDto.overrides,
    );
  }

  @Post(':moduleName/configuration/reset')
  @Roles('tenant_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Reset module configuration to defaults' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Module configuration reset successfully',
    type: TenantModule,
  })
  async resetConfiguration(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('moduleName') moduleName: string,
    @Body() resetDto: ResetConfigurationDto,
  ): Promise<TenantModule> {
    return this.configurationManagerService.resetConfiguration(
      tenantId,
      moduleName,
      user.id,
      resetDto.reason,
    );
  }

  @Get(':moduleName/configuration/audit')
  @ApiOperation({ summary: 'Get configuration change audit trail' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Configuration audit trail',
    type: [ConfigurationAuditEntryDto],
  })
  async getConfigurationAuditTrail(
    @CurrentTenant() tenantId: string,
    @Param('moduleName') moduleName: string,
    @Query() query: GetAuditTrailQueryDto,
  ): Promise<ConfigurationAuditEntryDto[]> {
    return this.configurationManagerService.getConfigurationAuditTrail(
      tenantId,
      moduleName,
      query.limit,
    );
  }

  @Get(':moduleName/dependencies/analyze')
  @ApiOperation({ summary: 'Analyze dependencies before enabling a module' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dependency analysis result',
    type: DependencyResolutionDto,
  })
  async analyzeDependenciesForEnable(
    @CurrentTenant() tenantId: string,
    @Param('moduleName') moduleName: string,
    @Query() query: AnalyzeDependenciesQueryDto,
  ): Promise<DependencyResolutionDto> {
    return this.dependencyManagerService.analyzeDependenciesForEnable(
      tenantId,
      moduleName,
      query.version,
    );
  }

  @Get(':moduleName/dependencies/analyze-disable')
  @ApiOperation({ summary: 'Analyze dependencies before disabling a module' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dependency analysis result for disable operation',
    type: DependencyResolutionDto,
  })
  async analyzeDependenciesForDisable(
    @CurrentTenant() tenantId: string,
    @Param('moduleName') moduleName: string,
  ): Promise<DependencyResolutionDto> {
    return this.dependencyManagerService.analyzeDependenciesForDisable(tenantId, moduleName);
  }

  @Get(':moduleName/dependencies/chain')
  @ApiOperation({ summary: 'Get dependency chain for a module' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Module dependency chain',
    type: DependencyNodeDto,
  })
  async getDependencyChain(
    @Param('moduleName') moduleName: string,
    @Query() query: AnalyzeDependenciesQueryDto,
  ): Promise<DependencyNodeDto> {
    return this.dependencyManagerService.getDependencyChain(moduleName, query.version);
  }

  @Get(':moduleName/dependencies/enhanced-functionality')
  @ApiOperation({ summary: 'Get enhanced functionality available with optional dependencies' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Enhanced functionality available',
    type: [EnhancedFunctionalityDto],
  })
  async getEnhancedFunctionality(
    @CurrentTenant() tenantId: string,
    @Param('moduleName') moduleName: string,
  ): Promise<EnhancedFunctionalityDto[]> {
    return this.dependencyManagerService.getEnhancedFunctionality(tenantId, moduleName);
  }

  @Post('dependencies/execute-plan')
  @Roles('tenant_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Execute a dependency resolution plan' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dependency plan execution result',
    type: DependencyPlanResultDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid dependency plan or conflicts detected',
  })
  async executeDependencyPlan(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() planDto: ExecuteDependencyPlanDto,
  ): Promise<DependencyPlanResultDto> {
    this.logger.log(`Executing dependency plan for tenant ${tenantId}: ${planDto.actions.length} actions`);
    
    // Filter actions based on includeOptional flag
    let actionsToExecute = planDto.actions;
    if (!planDto.includeOptional) {
      actionsToExecute = planDto.actions.filter(action => !action.isOptional);
    }

    return this.dependencyManagerService.executeDependencyPlan(
      tenantId,
      actionsToExecute,
      user.id,
    );
  }

  // Analytics Endpoints

  @Get(':moduleName/analytics/usage')
  @ApiOperation({ summary: 'Get usage metrics for a specific module' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Module usage metrics',
    type: UsageMetricsDto,
  })
  async getModuleUsageMetrics(
    @CurrentTenant() tenantId: string,
    @Param('moduleName') moduleName: string,
    @Query() query: GetUsageMetricsQueryDto,
  ): Promise<UsageMetricsDto> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    return this.moduleUsageAnalyticsService.getModuleUsageMetrics(
      moduleName,
      startDate,
      endDate,
      query.tenantId || tenantId,
    );
  }

  @Get(':moduleName/analytics/adoption')
  @ApiOperation({ summary: 'Get adoption metrics for a specific module' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Module adoption metrics',
    type: ModuleAdoptionMetricsDto,
  })
  async getModuleAdoptionMetrics(
    @Param('moduleName') moduleName: string,
    @Query() query: GetUsageMetricsQueryDto,
  ): Promise<ModuleAdoptionMetricsDto> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    return this.moduleUsageAnalyticsService.getModuleAdoptionMetrics(
      moduleName,
      startDate,
      endDate,
    );
  }

  @Get(':moduleName/analytics/performance')
  @ApiOperation({ summary: 'Get performance metrics for a specific module' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Module performance metrics',
    type: PerformanceMetricsDto,
  })
  async getModulePerformanceMetrics(
    @Param('moduleName') moduleName: string,
    @Query() query: GetUsageMetricsQueryDto,
  ): Promise<PerformanceMetricsDto> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    return this.moduleUsageAnalyticsService.getModulePerformanceMetrics(
      moduleName,
      startDate,
      endDate,
    );
  }

  @Get(':moduleName/analytics/feature-flags')
  @ApiOperation({ summary: 'Get feature flag usage statistics for a module' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Feature flag usage statistics',
    type: [FeatureFlagUsageDto],
  })
  async getFeatureFlagUsage(
    @Param('moduleName') moduleName: string,
    @Query() query: GetUsageMetricsQueryDto,
  ): Promise<FeatureFlagUsageDto[]> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    return this.moduleUsageAnalyticsService.getFeatureFlagUsage(
      moduleName,
      startDate,
      endDate,
    );
  }

  @Get('analytics/report')
  @ApiOperation({ summary: 'Generate comprehensive usage report for tenant modules' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Comprehensive usage report',
    type: UsageReportDto,
  })
  async generateUsageReport(
    @CurrentTenant() tenantId: string,
    @Query() query: GenerateReportQueryDto,
  ): Promise<UsageReportDto> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    // Get tenant's enabled modules if no specific modules requested
    let moduleNames = query.modules;
    if (!moduleNames) {
      const tenantModules = await this.tenantModuleService.getTenantModules(tenantId);
      moduleNames = tenantModules.map(tm => tm.moduleName);
    }
    
    return this.moduleUsageAnalyticsService.generateUsageReport(
      startDate,
      endDate,
      moduleNames,
    );
  }

  @Get('analytics/realtime')
  @ApiOperation({ summary: 'Get real-time usage statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Real-time usage statistics',
    type: RealTimeStatsDto,
  })
  async getRealTimeStats(): Promise<RealTimeStatsDto> {
    return this.moduleUsageAnalyticsService.getRealTimeStats();
  }

  @Post('analytics/track-event')
  @Roles('tenant_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Track a module event for analytics' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Event tracked successfully',
  })
  async trackModuleEvent(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() trackDto: TrackEventDto,
  ): Promise<void> {
    await this.moduleUsageAnalyticsService.trackModuleEvent(
      tenantId,
      trackDto.moduleName,
      trackDto.event,
      user.id,
      trackDto.metadata,
    );
  }

  @Post('analytics/track-feature-flag')
  @Roles('tenant_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Track feature flag usage for analytics' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Feature flag usage tracked successfully',
  })
  async trackFeatureFlagUsage(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() trackDto: TrackFeatureFlagDto,
  ): Promise<void> {
    await this.moduleUsageAnalyticsService.trackFeatureFlagUsage(
      tenantId,
      trackDto.moduleName,
      trackDto.flagName,
      trackDto.enabled,
      user.id,
    );
  }
}