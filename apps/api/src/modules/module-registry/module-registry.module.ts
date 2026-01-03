import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ModuleRegistryController } from './module-registry.controller';
import { TenantModuleController } from './tenant-module.controller';
import { BillingIntegrationController } from './billing-integration.controller';
import { PermissionIntegrationController } from './permission-integration.controller';
import { ModuleRegistryService } from './module-registry.service';
import { TenantModuleService } from './tenant-module.service';
import { VersionManagerService } from './version-manager.service';
import { ConfigurationManagerService } from './configuration-manager.service';
import { DependencyManagerService } from './dependency-manager.service';
import { ModuleUsageAnalyticsService } from './module-usage-analytics.service';
import { BillingIntegrationService } from './billing-integration.service';
import { PermissionIntegrationService } from './permission-integration.service';
import { UsageTrackingMiddleware } from './middleware/usage-tracking.middleware';
import { ModuleRegistry, TenantModule, ModuleUsageAnalytics, Subscription, Permission, UserRole, AuditLog } from '@syspro/database';
import { CacheService } from '../../shared/services/cache.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ModuleRegistry,
      TenantModule,
      ModuleUsageAnalytics,
      Subscription,
      Permission,
      UserRole,
      AuditLog,
    ]),
    EventEmitterModule,
  ],
  controllers: [
    ModuleRegistryController, 
    TenantModuleController,
    BillingIntegrationController,
    PermissionIntegrationController,
  ],
  providers: [
    ModuleRegistryService,
    TenantModuleService,
    VersionManagerService,
    ConfigurationManagerService,
    DependencyManagerService,
    ModuleUsageAnalyticsService,
    BillingIntegrationService,
    PermissionIntegrationService,
    UsageTrackingMiddleware,
    CacheService,
  ],
  exports: [
    ModuleRegistryService,
    TenantModuleService,
    VersionManagerService,
    ConfigurationManagerService,
    DependencyManagerService,
    ModuleUsageAnalyticsService,
    BillingIntegrationService,
    PermissionIntegrationService,
    UsageTrackingMiddleware,
    CacheService,
  ],
})
export class ModuleRegistryModule {}