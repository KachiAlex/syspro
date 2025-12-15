import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { PermissionService } from './permission.service';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UserRole } from './entities/user-role.entity';
import { TenantModule } from '../../modules/tenant/tenant.module';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, Permission, RolePermission, UserRole]),
    TenantModule,
    SharedModule,
  ],
  controllers: [RoleController],
  providers: [RoleService, PermissionService],
  exports: [RoleService, PermissionService],
})
export class RoleModule {}

