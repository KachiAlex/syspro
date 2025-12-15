import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ModuleRegistryService } from './module-registry.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { Roles } from '../../modules/auth/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';

@ApiTags('Module Registry')
@ApiBearerAuth()
@Controller('modules')
@UseGuards(JwtAuthGuard)
export class ModuleRegistryController {
  constructor(private readonly moduleRegistryService: ModuleRegistryService) {}

  @Post('register')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Register a new module' })
  async registerModule(@Body() moduleData: any) {
    return this.moduleRegistryService.registerModule(moduleData);
  }

  @Get()
  @ApiOperation({ summary: 'Get all available modules' })
  async findAll() {
    return this.moduleRegistryService.findAll();
  }

  @Get('enabled')
  @ApiOperation({ summary: 'Get enabled modules for current tenant' })
  async getEnabledModules() {
    return this.moduleRegistryService.getEnabledModulesForTenant();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get module by ID' })
  async findOne(@Param('id') id: string) {
    return this.moduleRegistryService.findOne(id);
  }

  @Post(':id/enable')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CEO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Enable module for current tenant' })
  async enableModule(@Param('id') id: string) {
    return this.moduleRegistryService.enableModuleForTenant(id);
  }

  @Post(':id/disable')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.CEO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Disable module for current tenant' })
  async disableModule(@Param('id') id: string) {
    await this.moduleRegistryService.disableModuleForTenant(id);
    return { message: 'Module disabled successfully' };
  }

  @Patch(':id/version')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update module version' })
  async updateVersion(
    @Param('id') id: string,
    @Body() body: { version: string },
  ) {
    return this.moduleRegistryService.updateModuleVersion(id, body.version);
  }
}

