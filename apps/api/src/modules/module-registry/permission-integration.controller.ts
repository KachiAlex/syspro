import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { Roles } from '../../modules/auth/decorators/roles.decorator';
import { CurrentUser } from '../../modules/auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../modules/auth/decorators/current-tenant.decorator';
import { PermissionIntegrationService, ModulePermissionTemplate, PermissionFilterResult } from './permission-integration.service';

@Controller('api/v1/module-registry/permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PermissionIntegrationController {
  private readonly logger = new Logger(PermissionIntegrationController.name);

  constructor(private permissionService: PermissionIntegrationService) {}

  /**
   * Get module-specific role templates
   * GET /api/v1/module-registry/permissions/templates/:moduleName
   */
  @Get('templates/:moduleName')
  @Roles('admin', 'tenant_admin')
  async getModuleRoleTemplates(
    @Param('moduleName') moduleName: string,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.log(`Fetching role templates for module: ${moduleName}`);

    try {
      const templates = await this.permissionService.getModuleRoleTemplates(moduleName);

      if (!templates || templates.length === 0) {
        throw new NotFoundException(`No role templates found for module: ${moduleName}`);
      }

      return {
        success: true,
        data: {
          moduleName,
          roles: templates,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch role templates: ${error.message}`);
      throw error;
    }
  }

  /**
   * Apply role template to user
   * POST /api/v1/module-registry/permissions/apply-template
   */
  @Post('apply-template')
  @Roles('admin', 'tenant_admin')
  @HttpCode(HttpStatus.OK)
  async applyRoleTemplate(
    @Body() body: {
      userId: string;
      moduleName: string;
      roleName: string;
    },
    @CurrentUser() currentUser: any,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.log(`Applying role template: ${body.roleName} for module ${body.moduleName} to user ${body.userId}`);

    if (!body.userId || !body.moduleName || !body.roleName) {
      throw new BadRequestException('userId, moduleName, and roleName are required');
    }

    try {
      await this.permissionService.applyRoleTemplate(
        tenantId,
        body.userId,
        body.moduleName,
        body.roleName,
        currentUser.id,
      );

      return {
        success: true,
        message: `Role template '${body.roleName}' applied successfully`,
        data: {
          userId: body.userId,
          moduleName: body.moduleName,
          roleName: body.roleName,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to apply role template: ${error.message}`);
      throw error;
    }
  }

  /**
   * Filter user permissions based on enabled modules
   * POST /api/v1/module-registry/permissions/filter
   */
  @Post('filter')
  @Roles('admin', 'tenant_admin')
  @HttpCode(HttpStatus.OK)
  async filterPermissions(
    @Body() body: {
      userId: string;
      permissions: string[];
    },
    @CurrentTenant() tenantId: string,
  ): Promise<PermissionFilterResult> {
    this.logger.log(`Filtering permissions for user ${body.userId}`);

    if (!body.userId || !body.permissions || !Array.isArray(body.permissions)) {
      throw new BadRequestException('userId and permissions array are required');
    }

    try {
      const result = await this.permissionService.filterPermissionsByEnabledModules(
        tenantId,
        body.userId,
        body.permissions,
      );

      return {
        allowedPermissions: result.allowedPermissions,
        deniedPermissions: result.deniedPermissions,
        moduleContext: result.moduleContext,
      };
    } catch (error) {
      this.logger.error(`Failed to filter permissions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get permission audit trail with module context
   * GET /api/v1/module-registry/permissions/audit-trail
   */
  @Get('audit-trail')
  @Roles('admin', 'tenant_admin')
  async getPermissionAuditTrail(
    @CurrentTenant() tenantId: string,
    @Query('moduleName') moduleName?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`Fetching permission audit trail for tenant ${tenantId}`);

    try {
      const auditTrail = await this.permissionService.getPermissionAuditTrail(tenantId, {
        moduleName,
        userId,
        action,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit: limit ? parseInt(limit, 10) : 100,
      });

      return {
        success: true,
        data: {
          count: auditTrail.length,
          auditTrail,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch audit trail: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user permissions for a specific module
   * GET /api/v1/module-registry/permissions/user/:userId/module/:moduleName
   */
  @Get('user/:userId/module/:moduleName')
  @Roles('admin', 'tenant_admin')
  async getUserModulePermissions(
    @Param('userId') userId: string,
    @Param('moduleName') moduleName: string,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.log(`Fetching permissions for user ${userId} in module ${moduleName}`);

    try {
      // Get all permissions for the module
      const modulePermissions = await this.permissionService.getModuleRoleTemplates(moduleName);

      if (!modulePermissions || modulePermissions.length === 0) {
        throw new NotFoundException(`No permissions found for module: ${moduleName}`);
      }

      // Filter to get user's actual permissions
      const userPermissionNames = modulePermissions.flatMap(role => role.permissions);
      const result = await this.permissionService.filterPermissionsByEnabledModules(
        tenantId,
        userId,
        userPermissionNames,
      );

      return {
        success: true,
        data: {
          userId,
          moduleName,
          allowedPermissions: result.allowedPermissions,
          deniedPermissions: result.deniedPermissions,
          moduleEnabled: result.moduleContext[moduleName] || false,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch user module permissions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bulk apply role template to multiple users
   * POST /api/v1/module-registry/permissions/bulk-apply-template
   */
  @Post('bulk-apply-template')
  @Roles('admin', 'tenant_admin')
  @HttpCode(HttpStatus.OK)
  async bulkApplyRoleTemplate(
    @Body() body: {
      userIds: string[];
      moduleName: string;
      roleName: string;
    },
    @CurrentUser() currentUser: any,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.log(`Bulk applying role template: ${body.roleName} for module ${body.moduleName} to ${body.userIds.length} users`);

    if (!body.userIds || !Array.isArray(body.userIds) || body.userIds.length === 0) {
      throw new BadRequestException('userIds array is required and must not be empty');
    }

    if (!body.moduleName || !body.roleName) {
      throw new BadRequestException('moduleName and roleName are required');
    }

    try {
      const results = [];
      const errors = [];

      for (const userId of body.userIds) {
        try {
          await this.permissionService.applyRoleTemplate(
            tenantId,
            userId,
            body.moduleName,
            body.roleName,
            currentUser.id,
          );
          results.push({ userId, success: true });
        } catch (error) {
          errors.push({ userId, error: error.message });
        }
      }

      return {
        success: errors.length === 0,
        data: {
          moduleName: body.moduleName,
          roleName: body.roleName,
          totalUsers: body.userIds.length,
          successCount: results.length,
          failureCount: errors.length,
          results,
          errors: errors.length > 0 ? errors : undefined,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to bulk apply role template: ${error.message}`);
      throw error;
    }
  }
}
