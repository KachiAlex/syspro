import { Module as NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModuleRegistryController } from './module-registry.controller';
import { ModuleRegistryService } from './module-registry.service';
import { Module } from './entities/module.entity';
import { TenantModule as TenantModuleEntity } from './entities/tenant-module.entity';
import { TenantModule } from '../../modules/tenant/tenant.module';
import { SharedModule } from '../../shared/shared.module';

@NestModule({
  imports: [
    TypeOrmModule.forFeature([Module, TenantModuleEntity]),
    TenantModule,
    SharedModule,
  ],
  controllers: [ModuleRegistryController],
  providers: [ModuleRegistryService],
  exports: [ModuleRegistryService],
})
export class ModuleRegistryModule {}
