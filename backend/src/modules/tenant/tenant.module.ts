import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { TenantContextService } from './tenant-context.service';
import { TenantInterceptor } from './interceptors/tenant.interceptor';
import { Tenant } from '../../entities/tenant.entity';
import { UserTenantAccess } from '../../entities/user-tenant-access.entity';
import { UsersModule } from '../users/users.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, UserTenantAccess]),
    UsersModule,
  ],
  controllers: [TenantController],
  providers: [
    TenantService,
    TenantContextService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
  exports: [TenantService, TenantContextService],
})
export class TenantModule {}

