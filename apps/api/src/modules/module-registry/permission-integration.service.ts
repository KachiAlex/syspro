import { Injectable, Logger } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, QueryDeepPartialEntity } from 'typeorm';

import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ModuleRegistry, TenantModule, Permission, UserRole, AuditLog } from '@syspro/database';
import { CacheService } from '../../shared/services/cache.service';

export interface ModulePermissionTemplate {
  moduleName: string;
  permissions: {
    name: string;
    description: string;
    resource: string;
    action: string;
    isCore: boolean;
  }[];
  roles: {
    name: string;
    description: string;
    permissions: string[];
    isDefault: boolean;
  }[];
}

interface PermissionAuditDetails {
  [key: string]: any;
}

export interface PermissionFilterResult {
  allowedPermissions: string[];
  deniedPermissions: string[];
  moduleContext: Record<string, boolean>;
}

@Injectable()
export class PermissionIntegrationService {
  private readonly logger = new Logger(PermissionIntegrationService.name);

  constructor(
    @InjectRepository(ModuleRegistry)
    private moduleRepository: Repository<ModuleRegistry>,
    @InjectRepository(TenantModule)
    private tenantModuleRepository: Repository<TenantModule>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(UserRole)
    private userRoleRepository: Repository<UserRole>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private cacheService: CacheService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Handle module enabled event for permission management
   */
  @OnEvent('module.enabled')
  async handleModuleEnabled(event: {
    tenantId: string;
    moduleName: string;
    moduleId: string;
    userId: string;
    timestamp: Date;
  }): Promise<void> {
    this.logger.log(`Processing permissions for module enabled: ${event.moduleName} for tenant ${event.tenantId}`);

    try {
      // Get module permission template
      const template = await this.getModulePermissionTemplate(event.moduleName);
      if (!template) {
        this.logger.warn(`No permission template found for module: ${event.moduleName}`);
        return;
      }

      // Create module-specific permissions for the tenant
      await this.createModulePermissions(event.tenantId, template);

      // Apply default role templates
      await this.applyDefaultRoleTemplates(event.tenantId, template);

      // Clear permission cache for tenant
      await this.clearTenantPermissionCache(event.tenantId);

      // Create audit trail
      await this.createPermissionAuditTrail({
        tenantId: event.tenantId,
        userId: event.userId,
        action: 'module_permissions_created',
        moduleName: event.moduleName,
        details: {
          permissionsCreated: template.permissions.length,
          rolesCreated: template.roles.filter(r => r.isDefault).length,
        },
      });

      this.logger.log(`Permissions created for module ${event.moduleName} in tenant ${event.tenantId}`);

    } catch (error) {
      this.logger.error(`Failed to process permissions for module enabled: ${error.message}`, error.stack);
      
      this.eventEmitter.emit('permission.error', {
        type: 'module_enabled_permission_failed',
        tenantId: event.tenantId,
        moduleName: event.moduleName,
        error: error.message,
        originalEvent: event,
      });
    }
  }

  /**
   * Handle module disabled event for permission management
   */
  @OnEvent('module.disabled')
  async handleModuleDisabled(event: {
    tenantId: string;
    moduleName: string;
    moduleId: string;
    userId: string;
    timestamp: Date;
  }): Promise<void> {
    this.logger.log(`Processing permissions for module disabled: ${event.moduleName} for tenant ${event.tenantId}`);

    try {
      // Get current module permissions
      const modulePermissions = await this.getModulePermissions(event.tenantId, event.moduleName);

      // Disable (don't delete) module-specific permissions
      await this.disableModulePermissions(event.tenantId, event.moduleName);

      // Update user roles to remove module permissions
      await this.removeModulePermissionsFromRoles(event.tenantId, event.moduleName);

      // Clear permission cache for tenant
      await this.clearTenantPermissionCache(event.tenantId);

      // Create audit trail
      await this.createPermissionAuditTrail({
        tenantId: event.tenantId,
        userId: event.userId,
        action: 'module_permissions_disabled',
        moduleName: event.moduleName,
        details: {
          permissionsDisabled: modulePermissions.length,
          timestamp: event.timestamp.toISOString(),
        },
      });

      this.logger.log(`Permissions disabled for module ${event.moduleName} in tenant ${event.tenantId}`);

    } catch (error) {
      this.logger.error(`Failed to process permissions for module disabled: ${error.message}`, error.stack);
      
      this.eventEmitter.emit('permission.error', {
        type: 'module_disabled_permission_failed',
        tenantId: event.tenantId,
        moduleName: event.moduleName,
        error: error.message,
        originalEvent: event,
      });
    }
  }

  /**
   * Filter user permissions based on enabled modules
   */
  async filterPermissionsByEnabledModules(
    tenantId: string,
    userId: string,
    requestedPermissions: string[],
  ): Promise<PermissionFilterResult> {
    const cacheKey = `permissions:filtered:${tenantId}:${userId}:${requestedPermissions.join(',')}`;
    let result = await this.cacheService.get<PermissionFilterResult>(cacheKey);

    if (!result) {
      // Get enabled modules for tenant
      const enabledModules = await this.getEnabledModulesForTenant(tenantId);
      const enabledModuleNames = enabledModules.map(m => m.moduleName);

      // Get user permissions
      const userPermissions = await this.getUserPermissions(tenantId, userId);

      // Filter permissions based on enabled modules
      const allowedPermissions: string[] = [];
      const deniedPermissions: string[] = [];
      const moduleContext: Record<string, boolean> = {};

      for (const permission of requestedPermissions) {
        const permissionModule = await this.getPermissionModule(permission);
        
        if (!permissionModule) {
          // Core permission (not module-specific)
          if (userPermissions.includes(permission)) {
            allowedPermissions.push(permission);
          } else {
            deniedPermissions.push(permission);
          }
          continue;
        }

        moduleContext[permissionModule] = enabledModuleNames.includes(permissionModule);

        if (enabledModuleNames.includes(permissionModule) && userPermissions.includes(permission)) {
          allowedPermissions.push(permission);
        } else {
          deniedPermissions.push(permission);
        }
      }

      result = {
        allowedPermissions,
        deniedPermissions,
        moduleContext,
      };

      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, result, 300);
    }

    return result;
  }

  /**
   * Get module-specific role templates
   */
  async getModuleRoleTemplates(moduleName: string): Promise<ModulePermissionTemplate['roles']> {
    const template = await this.getModulePermissionTemplate(moduleName);
    return template?.roles || [];
  }

  /**
   * Apply role template to user
   */
  async applyRoleTemplate(
    tenantId: string,
    userId: string,
    moduleName: string,
    roleName: string,
    appliedBy: string,
  ): Promise<void> {
    const template = await this.getModulePermissionTemplate(moduleName);
    if (!template) {
      throw new Error(`No permission template found for module: ${moduleName}`);
    }

    const roleTemplate = template.roles.find(r => r.name === roleName);
    if (!roleTemplate) {
      throw new Error(`Role template '${roleName}' not found for module: ${moduleName}`);
    }

    // Check if module is enabled for tenant
    const isModuleEnabled = await this.isModuleEnabledForTenant(tenantId, moduleName);
    if (!isModuleEnabled) {
      throw new Error(`Cannot apply role template: module '${moduleName}' is not enabled for tenant`);
    }

    const moduleRole = await this.userRoleRepository.findOne({
      where: {
        tenantId,
        code: `${moduleName}_${roleName}`.toUpperCase(),
      },
    });

    if (!moduleRole) {
      throw new Error(`Module role '${roleName}' not provisioned for tenant ${tenantId}`);
    }

    // Assign permissions to the module role (ensures PK consistency)
    await this.assignPermissionsToRole(tenantId, moduleRole.id, roleTemplate.permissions);

    // Create audit trail
    await this.createPermissionAuditTrail({
      tenantId,
      userId: appliedBy,
      action: 'role_template_applied',
      moduleName,
      details: {
        targetUserId: userId,
        roleName,
        permissionsGranted: roleTemplate.permissions,
      },
    });

    // Clear cache
    await this.clearUserPermissionCache(tenantId, userId);

    this.logger.log(`Applied role template '${roleName}' for module '${moduleName}' to user ${userId} in tenant ${tenantId}`);
  }

  /**
   * Get permission audit trail with module context
   */
  async getPermissionAuditTrail(
    tenantId: string,
    options: {
      moduleName?: string;
      userId?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {},
  ): Promise<AuditLog[]> {
    const query = this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.tenantId = :tenantId', { tenantId })
      .andWhere('audit.resource = :resource', { resource: 'permission' });

    if (options.moduleName) {
      query.andWhere("audit.newValues->>'moduleName' = :moduleName", { moduleName: options.moduleName });
    }

    if (options.userId) {
      query.andWhere('audit.userId = :userId', { userId: options.userId });
    }

    if (options.action) {
      query.andWhere('audit.action = :action', { action: options.action });
    }

    if (options.startDate) {
      query.andWhere('audit.createdAt >= :startDate', { startDate: options.startDate });
    }

    if (options.endDate) {
      query.andWhere('audit.createdAt <= :endDate', { endDate: options.endDate });
    }

    query
      .orderBy('audit.createdAt', 'DESC')
      .limit(options.limit || 100);

    return query.getMany();
  }

  /**
   * Private helper methods
   */

  private async getModulePermissionTemplate(moduleName: string): Promise<ModulePermissionTemplate | null> {
    const cacheKey = `permission:template:${moduleName}`;
    let template = await this.cacheService.get<ModulePermissionTemplate>(cacheKey);

    if (!template) {
      // In a real implementation, this would load from a configuration file or database
      template = this.getBuiltInPermissionTemplate(moduleName);
      
      if (template) {
        await this.cacheService.set(cacheKey, template, 3600); // 1 hour
      }
    }

    return template;
  }

  private getBuiltInPermissionTemplate(moduleName: string): ModulePermissionTemplate | null {
    const templates: Record<string, ModulePermissionTemplate> = {
      'crm': {
        moduleName: 'crm',
        permissions: [
          { name: 'crm:leads:read', description: 'View leads', resource: 'leads', action: 'read', isCore: false },
          { name: 'crm:leads:write', description: 'Create/edit leads', resource: 'leads', action: 'write', isCore: false },
          { name: 'crm:leads:delete', description: 'Delete leads', resource: 'leads', action: 'delete', isCore: false },
          { name: 'crm:customers:read', description: 'View customers', resource: 'customers', action: 'read', isCore: false },
          { name: 'crm:customers:write', description: 'Create/edit customers', resource: 'customers', action: 'write', isCore: false },
          { name: 'crm:deals:read', description: 'View deals', resource: 'deals', action: 'read', isCore: false },
          { name: 'crm:deals:write', description: 'Create/edit deals', resource: 'deals', action: 'write', isCore: false },
          { name: 'crm:reports:read', description: 'View CRM reports', resource: 'reports', action: 'read', isCore: false },
        ],
        roles: [
          {
            name: 'crm_user',
            description: 'Basic CRM user',
            permissions: ['crm:leads:read', 'crm:customers:read', 'crm:deals:read'],
            isDefault: true,
          },
          {
            name: 'crm_manager',
            description: 'CRM manager with full access',
            permissions: ['crm:leads:read', 'crm:leads:write', 'crm:customers:read', 'crm:customers:write', 'crm:deals:read', 'crm:deals:write', 'crm:reports:read'],
            isDefault: false,
          },
        ],
      },
      'hr': {
        moduleName: 'hr',
        permissions: [
          { name: 'hr:employees:read', description: 'View employees', resource: 'employees', action: 'read', isCore: false },
          { name: 'hr:employees:write', description: 'Create/edit employees', resource: 'employees', action: 'write', isCore: false },
          { name: 'hr:payroll:read', description: 'View payroll', resource: 'payroll', action: 'read', isCore: false },
          { name: 'hr:payroll:write', description: 'Process payroll', resource: 'payroll', action: 'write', isCore: false },
          { name: 'hr:attendance:read', description: 'View attendance', resource: 'attendance', action: 'read', isCore: false },
          { name: 'hr:reports:read', description: 'View HR reports', resource: 'reports', action: 'read', isCore: false },
        ],
        roles: [
          {
            name: 'hr_user',
            description: 'Basic HR user',
            permissions: ['hr:employees:read', 'hr:attendance:read'],
            isDefault: true,
          },
          {
            name: 'hr_manager',
            description: 'HR manager with payroll access',
            permissions: ['hr:employees:read', 'hr:employees:write', 'hr:payroll:read', 'hr:payroll:write', 'hr:attendance:read', 'hr:reports:read'],
            isDefault: false,
          },
        ],
      },
    };

    return templates[moduleName] || null;
  }

  private async createModulePermissions(tenantId: string, template: ModulePermissionTemplate): Promise<void> {
    for (const permissionDef of template.permissions) {
      // Check if permission already exists
      const existingPermission = await this.permissionRepository
        .createQueryBuilder('permission')
        .where('permission.tenantId = :tenantId', { tenantId })
        .andWhere('permission.name = :name', { name: permissionDef.name })
        .getOne();

      if (!existingPermission) {
        await this.permissionRepository.save(
          this.permissionRepository.create({
            tenantId,
            name: permissionDef.name,
            description: permissionDef.description,
            resource: permissionDef.resource,
            action: permissionDef.action,
            isActive: true,
            metadata: {
              moduleName: template.moduleName,
              isCore: permissionDef.isCore,
            },
          }),
        );
      }
    }
  }

  private async applyDefaultRoleTemplates(tenantId: string, template: ModulePermissionTemplate): Promise<void> {
    const defaultRoles = template.roles.filter(r => r.isDefault);
    
    for (const roleTemplate of defaultRoles) {
      // Create role if it doesn't exist
      const existingRole = await this.userRoleRepository.findOne({
        where: {
          tenantId,
          name: `${template.moduleName}_${roleTemplate.name}`,
        },
      });

      if (!existingRole) {
        const role = this.userRoleRepository.create({
          tenantId,
          name: `${template.moduleName}_${roleTemplate.name}`,
          description: roleTemplate.description,
          code: `${template.moduleName}_${roleTemplate.name}`.toUpperCase(),
        });

        const savedRole = await this.userRoleRepository.save(role);
        await this.assignPermissionsToRole(tenantId, savedRole.id, roleTemplate.permissions);
      } else {
        await this.assignPermissionsToRole(tenantId, existingRole.id, roleTemplate.permissions);
      }
    }
  }

  private async disableModulePermissions(tenantId: string, moduleName: string): Promise<void> {
    await this.permissionRepository
      .createQueryBuilder()
      .update()
      .set({ isActive: false } as QueryDeepPartialEntity<Permission>)
      .where('tenantId = :tenantId', { tenantId })
      .andWhere("metadata->>'moduleName' = :moduleName", { moduleName })
      .execute();
  }

  private async removeModulePermissionsFromRoles(tenantId: string, moduleName: string): Promise<void> {
    await this.permissionRepository
      .createQueryBuilder()
      .update()
      .set({ roleId: null })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere("metadata->>'moduleName' = :moduleName", { moduleName })
      .execute();
  }

  private async getEnabledModulesForTenant(tenantId: string): Promise<TenantModule[]> {
    return this.tenantModuleRepository.find({
      where: {
        tenantId,
        isEnabled: true,
      },
    });
  }

  private async getUserPermissions(tenantId: string, userId: string): Promise<string[]> {
    const cacheKey = `user:permissions:${tenantId}:${userId}`;
    let permissions = await this.cacheService.get<string[]>(cacheKey);

    if (!permissions) {
      // In a real implementation, this would query user roles and aggregate permissions
      permissions = [];
      await this.cacheService.set(cacheKey, permissions, 300); // 5 minutes
    }

    return permissions;
  }

  private async getPermissionModule(permission: string): Promise<string | null> {
    // Extract module name from permission (e.g., 'crm:leads:read' -> 'crm')
    const parts = permission.split(':');
    return parts.length > 1 ? parts[0] : null;
  }

  private async isModuleEnabledForTenant(tenantId: string, moduleName: string): Promise<boolean> {
    const tenantModule = await this.tenantModuleRepository.findOne({
      where: {
        tenantId,
        moduleName,
        isEnabled: true,
      },
    });

    return !!tenantModule;
  }

  private async getModulePermissions(tenantId: string, moduleName: string): Promise<Permission[]> {
    return this.permissionRepository
      .createQueryBuilder('permission')
      .where('permission.tenantId = :tenantId', { tenantId })
      .andWhere("permission.metadata->>'moduleName' = :moduleName", { moduleName })
      .getMany();
  }

  private async createPermissionAuditTrail(params: {
    tenantId: string;
    userId: string;
    action: string;
    moduleName: string;
    details: PermissionAuditDetails;
    previousState?: Record<string, any>;
  }): Promise<void> {
    const auditLog = this.auditLogRepository.create({
      tenantId: params.tenantId,
      userId: params.userId,
      resource: 'permission',
      resourceId: params.moduleName,
      action: params.action,
      oldValues: params.previousState,
      newValues: {
        moduleName: params.moduleName,
        ...params.details,
      },
      ipAddress: 'system',
      userAgent: 'module-registry-service',
    });

    await this.auditLogRepository.save(auditLog);
  }

  private async clearTenantPermissionCache(tenantId: string): Promise<void> {
    const pattern = `permissions:*:${tenantId}:*`;
    await this.cacheService.delPattern(pattern);
  }

  private async clearUserPermissionCache(tenantId: string, userId: string): Promise<void> {
    const patterns = [
      `user:permissions:${tenantId}:${userId}`,
      `permissions:filtered:${tenantId}:${userId}:*`,
    ];

    for (const pattern of patterns) {
      await this.cacheService.delPattern(pattern);
    }
  }

  private async assignPermissionsToRole(
    tenantId: string,
    roleId: string,
    permissionNames: string[],
  ): Promise<void> {
    if (!permissionNames || permissionNames.length === 0) {
      return;
    }

    const permissions = await this.permissionRepository
      .createQueryBuilder('permission')
      .where('permission.tenantId = :tenantId', { tenantId })
      .andWhere('permission.name IN (:...permissionNames)', { permissionNames })
      .getMany();

    if (!permissions.length) {
      this.logger.warn(
        `No permissions found to assign for role ${roleId} in tenant ${tenantId}`,
      );
      return;
    }

    for (const permission of permissions) {
      permission.roleId = roleId;
    }

    await this.permissionRepository.save(permissions);
  }
}