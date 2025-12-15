import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoleService } from './role.service';
import { PermissionService } from './permission.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { Roles } from '../../modules/auth/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';

@ApiTags('Roles & Permissions')
@ApiBearerAuth()
@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RoleController {
  constructor(
    private readonly roleService: RoleService,
    private readonly permissionService: PermissionService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Create a new role' })
  async create(@Body() createRoleDto: CreateRoleDto) {
    return this.roleService.create(createRoleDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all roles' })
  async findAll(@Query('scope') scope?: string) {
    return this.roleService.findAll(scope as any);
  }

  @Get('permissions')
  @ApiOperation({ summary: 'Get all permissions' })
  async getPermissions() {
    return this.permissionService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get role by ID' })
  async findOne(@Param('id') id: string) {
    return this.roleService.findOne(id);
  }

  @Post(':id/permissions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign permissions to role' })
  async assignPermissions(
    @Param('id') id: string,
    @Body() body: { permissionIds: string[] },
  ) {
    await this.roleService.assignPermissions(id, body.permissionIds);
    return { message: 'Permissions assigned successfully' };
  }

  @Delete(':id/permissions/:permissionId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Revoke permission from role' })
  async revokePermission(
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
  ) {
    await this.roleService.revokePermission(id, permissionId);
    return { message: 'Permission revoked successfully' };
  }

  @Post('users/:userId/assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Assign role to user' })
  async assignRoleToUser(
    @Param('userId') userId: string,
    @Body() body: { roleId: string },
  ) {
    return this.roleService.assignRoleToUser(userId, body.roleId);
  }

  @Delete('users/:userId/revoke/:roleId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Revoke role from user' })
  async revokeRoleFromUser(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ) {
    await this.roleService.revokeRoleFromUser(userId, roleId);
    return { message: 'Role revoked successfully' };
  }

  @Get('users/me/roles')
  @ApiOperation({ summary: 'Get current user roles' })
  async getMyRoles(@CurrentUser() user: User) {
    return this.roleService.getUserRoles(user.id);
  }

  @Get('users/me/permissions')
  @ApiOperation({ summary: 'Get current user permissions' })
  async getMyPermissions(@CurrentUser() user: User) {
    return this.roleService.getUserPermissions(user.id);
  }

  @Get('users/:userId/permissions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get user permissions' })
  async getUserPermissions(@Param('userId') userId: string) {
    return this.roleService.getUserPermissions(userId);
  }
}

