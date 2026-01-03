import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ModuleRegistryController } from './module-registry.controller';
import { TenantModuleController } from './tenant-module.controller';
import { ModuleRegistryService } from './module-registry.service';
import { TenantModuleService } from './tenant-module.service';
import { VersionManagerService } from './version-manager.service';
import { ConfigurationManagerService } from './configuration-manager.service';
import { DependencyManagerService } from './dependency-manager.service';
import { ModuleUsageAnalyticsService } from './module-usage-analytics.service';
import { UsageTrackingMiddleware } from './middleware/usage-tracking.middleware';
import { ModuleRegistry, TenantModule, ModuleUsageAnalytics } from '@syspro/database';
import { CacheService } from '../../shared/services/cache.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ModuleRegistry,
      TenantModule,
      ModuleUsageAnalytics,
    ]),
    EventEmitterModule,
  ],
  controllers: [ModuleRegistryController, TenantModuleController],
  providers: [
    ModuleRegistryService,
    TenantModuleService,
    VersionManagerService,
    ConfigurationManagerService,
    DependencyManagerService,
    ModuleUsageAnalyticsService,
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
    UsageTrackingMiddleware,
    CacheService,
  ],
})
export class ModuleRegistryModule {}