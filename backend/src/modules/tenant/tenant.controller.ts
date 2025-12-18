import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { SwitchTenantDto } from './dto/switch-tenant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from './guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { Tenant } from './decorators/tenant.decorator';
// Note: AuthService method will be added in next update

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new tenant' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantService.create(createTenantDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tenants' })
  @ApiResponse({ status: 200, description: 'List of tenants' })
  async findAll(@CurrentUser() user: User) {
    // Super admin and CEO can see all tenants
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.CEO) {
      return this.tenantService.findAll();
    }

    // Other users see only their accessible tenants
    return this.tenantService.getUserTenants(user.id);
  }

  @Get(':id')
  @UseGuards(TenantGuard)
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiResponse({ status: 200, description: 'Tenant details' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async findOne(@Param('id') id: string) {
    return this.tenantService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CEO)
  @ApiOperation({ summary: 'Update tenant' })
  @ApiResponse({ status: 200, description: 'Tenant updated' })
  async update(
    @Param('id') id: string,
    @Body() updateTenantDto: UpdateTenantDto,
  ) {
    return this.tenantService.update(id, updateTenantDto);
  }

  @Delete(':id')
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete tenant' })
  @ApiResponse({ status: 200, description: 'Tenant deleted' })
  async remove(@Param('id') id: string) {
    await this.tenantService.remove(id);
    return { message: 'Tenant deleted successfully' };
  }

  @Post('switch')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CEO, UserRole.HR)
  @ApiOperation({ summary: 'Switch to a different tenant' })
  @ApiResponse({ status: 200, description: 'Tenant switched successfully' })
  @ApiResponse({ status: 403, description: 'Access denied to tenant' })
  async switchTenant(
    @Body() switchTenantDto: SwitchTenantDto,
    @CurrentUser() user: User,
  ) {
    // Validate user has access to the requested tenant
    const hasAccess = await this.tenantService.validateUserTenantAccess(
      user.id,
      switchTenantDto.tenantId,
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have access to this tenant',
      );
    }

    // Verify tenant exists
    await this.tenantService.findOne(switchTenantDto.tenantId);

    // Return success - tokens will be regenerated on next request
    // The tenantId is now set in the request context
    return {
      message: 'Tenant switched successfully',
      tenantId: switchTenantDto.tenantId,
      note: 'Use the new tenantId in x-tenant-id header for subsequent requests',
    };
  }

  @Get('user/accessible')
  @ApiOperation({ summary: 'Get all tenants accessible by current user' })
  @ApiResponse({ status: 200, description: 'List of accessible tenants' })
  async getUserAccessibleTenants(@CurrentUser() user: User) {
    return this.tenantService.getUserTenants(user.id);
  }
}

