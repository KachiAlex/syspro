import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role, RoleScope } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UserRole } from './entities/user-role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { TenantContextService } from '../../modules/tenant/tenant-context.service';
import { EventPublisherService } from '../../shared/events/event-publisher.service';
import { EventType } from '../../shared/events/event.types';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private rolePermissionRepository: Repository<RolePermission>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    private readonly tenantContext: TenantContextService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    const tenantId = this.tenantContext.getTenant();

    // Validate scope
    if (createRoleDto.scope === RoleScope.TENANT && !tenantId) {
      throw new BadRequestException('Tenant ID required for tenant-scoped roles');
    }

    if (createRoleDto.scope === RoleScope.SYSTEM && tenantId) {
      throw new BadRequestException('System roles cannot be tenant-specific');
    }

    const role = this.roleRepository.create({
      ...createRoleDto,
      tenantId: createRoleDto.scope === RoleScope.TENANT ? tenantId : null,
    });

    const savedRole = await this.roleRepository.save(role);

    // Assign permissions if provided
    if (createRoleDto.permissionIds && createRoleDto.permissionIds.length > 0) {
      await this.assignPermissions(savedRole.id, createRoleDto.permissionIds);
    }

    await this.eventPublisher.publish(EventType.ROLE_CREATED, {
      roleId: savedRole.id,
      tenantId: savedRole.tenantId,
    });

    return this.findOne(savedRole.id);
  }

  async findAll(scope?: RoleScope): Promise<Role[]> {
    const tenantId = this.tenantContext.getTenant();
    const where: any = { isActive: true };

    if (scope) {
      where.scope = scope;
    }

    if (tenantId) {
      where.tenantId = tenantId;
    } else {
      // If no tenant, only show system roles
      where.scope = RoleScope.SYSTEM;
    }

    return this.roleRepository.find({
      where,
      relations: ['permissions'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Role> {
    const tenantId = this.tenantContext.getTenant();
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    // Validate tenant access
    if (role.scope === RoleScope.TENANT && role.tenantId !== tenantId) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async assignPermissions(roleId: string, permissionIds: string[]): Promise<void> {
    const role = await this.findOne(roleId);
    const tenantId = this.tenantContext.getTenant();

    const permissions = await this.permissionRepository.find({
      where: { id: In(permissionIds) },
    });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('Some permissions not found');
    }

    // Remove existing permissions
    await this.rolePermissionRepository.delete({ roleId });

    // Add new permissions
    const rolePermissions = permissions.map((permission) =>
      this.rolePermissionRepository.create({
        roleId: role.id,
        permissionId: permission.id,
        tenantId: role.tenantId || tenantId,
      }),
    );

    await this.rolePermissionRepository.save(rolePermissions);

    await this.eventPublisher.publish(EventType.PERMISSION_GRANTED, {
      roleId,
      permissionIds,
      tenantId,
    });
  }

  async revokePermission(roleId: string, permissionId: string): Promise<void> {
    await this.rolePermissionRepository.delete({ roleId, permissionId });

    await this.eventPublisher.publish(EventType.PERMISSION_REVOKED, {
      roleId,
      permissionId,
      tenantId: this.tenantContext.getTenant(),
    });
  }

  async assignRoleToUser(userId: string, roleId: string): Promise<UserRole> {
    const tenantId = this.tenantContext.requireTenant();
    const role = await this.findOne(roleId);

    // Check if already assigned
    const existing = await this.userRoleRepository.findOne({
      where: { userId, roleId, tenantId },
    });

    if (existing) {
      existing.isActive = true;
      return this.userRoleRepository.save(existing);
    }

    const userRole = this.userRoleRepository.create({
      userId,
      roleId,
      tenantId,
      isActive: true,
    });

    return this.userRoleRepository.save(userRole);
  }

  async revokeRoleFromUser(userId: string, roleId: string): Promise<void> {
    const tenantId = this.tenantContext.requireTenant();

    await this.userRoleRepository.update(
      { userId, roleId, tenantId },
      { isActive: false },
    );
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    const tenantId = this.tenantContext.requireTenant();

    const userRoles = await this.userRoleRepository.find({
      where: { userId, tenantId, isActive: true },
      relations: ['role', 'role.permissions'],
    });

    return userRoles.map((ur) => ur.role);
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    const roles = await this.getUserRoles(userId);
    const permissionMap = new Map<string, Permission>();

    roles.forEach((role) => {
      role.permissions?.forEach((permission) => {
        if (!permissionMap.has(permission.id)) {
          permissionMap.set(permission.id, permission);
        }
      });
    });

    return Array.from(permissionMap.values());
  }

  async checkPermission(
    userId: string,
    resource: string,
    action: string,
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    const permissionCode = `${resource}:${action}`;

    return permissions.some((p) => p.code === permissionCode);
  }
}

