import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ModuleRegistryService } from './module-registry.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ModuleRegistry, ModuleCategory, PricingModel } from '@syspro/database';
import {
  CreateModuleDto,
  UpdateModuleDto,
  ModuleStatusDto,
  ModuleCompatibilityCheckDto,
  ModuleCompatibilityResultDto,
  ModuleDependencyTreeDto,
  ModuleStatisticsDto,
  BulkModuleOperationDto,
  BulkModuleOperationResultDto,
} from './dto/module-registry.dto';

@ApiTags('Module Registry')
@Controller('api/v1/modules')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ModuleRegistryController {
  private readonly logger = new Logger(ModuleRegistryController.name);

  constructor(private readonly moduleRegistryService: ModuleRegistryService) {}

  @Post()
  @Roles('system_admin', 'super_admin')
  @ApiOperation({ summary: 'Register a new module' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Module registered successfully',
    type: ModuleRegistry,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid module data or missing dependencies',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Module with this name already exists',
  })
  async registerModule(@Body() createModuleDto: CreateModuleDto): Promise<ModuleRegistry> {
    this.logger.log(`Registering module: ${createModuleDto.name}`);
    return this.moduleRegistryService.registerModule(createModuleDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all active modules' })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: ModuleCategory,
    description: 'Filter by module category',
  })
  @ApiQuery({
    name: 'pricingModel',
    required: false,
    enum: PricingModel,
    description: 'Filter by pricing model',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of modules',
    type: [ModuleRegistry],
  })
  async getModules(
    @Query('category') category?: ModuleCategory,
    @Query('pricingModel') pricingModel?: PricingModel,
  ): Promise<ModuleRegistry[]> {
    if (category) {
      return this.moduleRegistryService.getModulesByCategory(category);
    }
    
    if (pricingModel) {
      return this.moduleRegistryService.getModulesByPricingModel(pricingModel);
    }

    return this.moduleRegistryService.getAllModules();
  }

  @Get('core')
  @ApiOperation({ summary: 'Get all core modules' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of core modules',
    type: [ModuleRegistry],
  })
  async getCoreModules(): Promise<ModuleRegistry[]> {
    return this.moduleRegistryService.getCoreModules();
  }

  @Get('statistics')
  @Roles('system_admin', 'super_admin', 'tenant_admin')
  @ApiOperation({ summary: 'Get module statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Module statistics',
    type: ModuleStatisticsDto,
  })
  async getModuleStatistics(): Promise<ModuleStatisticsDto> {
    return this.moduleRegistryService.getModuleStatistics();
  }

  @Post('compatibility-check')
  @ApiOperation({ summary: 'Check module compatibility' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Compatibility check result',
    type: ModuleCompatibilityResultDto,
  })
  async checkCompatibility(
    @Body() compatibilityDto: ModuleCompatibilityCheckDto,
  ): Promise<ModuleCompatibilityResultDto> {
    return this.moduleRegistryService.validateModuleCompatibility(compatibilityDto.modules);
  }

  @Post('bulk-operation')
  @Roles('system_admin', 'super_admin')
  @ApiOperation({ summary: 'Perform bulk operations on modules' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk operation result',
    type: BulkModuleOperationResultDto,
  })
  async bulkOperation(
    @Body() bulkOperationDto: BulkModuleOperationDto,
  ): Promise<BulkModuleOperationResultDto> {
    const result: BulkModuleOperationResultDto = {
      successful: [],
      failed: {},
      total: bulkOperationDto.moduleNames.length,
      successCount: 0,
      failureCount: 0,
    };

    for (const moduleName of bulkOperationDto.moduleNames) {
      try {
        const isActive = bulkOperationDto.operation === 'activate';
        await this.moduleRegistryService.setModuleStatus(moduleName, isActive);
        result.successful.push(moduleName);
        result.successCount++;
      } catch (error) {
        result.failed[moduleName] = error.message;
        result.failureCount++;
      }
    }

    return result;
  }

  @Get(':name')
  @ApiOperation({ summary: 'Get a specific module by name' })
  @ApiParam({ name: 'name', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Module details',
    type: ModuleRegistry,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found',
  })
  async getModule(@Param('name') name: string): Promise<ModuleRegistry> {
    const module = await this.moduleRegistryService.getModuleByName(name);
    if (!module) {
      throw new Error(`Module '${name}' not found`);
    }
    return module;
  }

  @Put(':name')
  @Roles('system_admin', 'super_admin')
  @ApiOperation({ summary: 'Update a module' })
  @ApiParam({ name: 'name', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Module updated successfully',
    type: ModuleRegistry,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found',
  })
  async updateModule(
    @Param('name') name: string,
    @Body() updateModuleDto: UpdateModuleDto,
  ): Promise<ModuleRegistry> {
    return this.moduleRegistryService.updateModule(name, updateModuleDto);
  }

  @Patch(':name/status')
  @Roles('system_admin', 'super_admin')
  @ApiOperation({ summary: 'Update module status (activate/deactivate)' })
  @ApiParam({ name: 'name', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Module status updated successfully',
    type: ModuleRegistry,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot deactivate core modules',
  })
  async updateModuleStatus(
    @Param('name') name: string,
    @Body() statusDto: ModuleStatusDto,
  ): Promise<ModuleRegistry> {
    return this.moduleRegistryService.setModuleStatus(name, statusDto.isActive);
  }

  @Get(':name/dependencies')
  @ApiOperation({ summary: 'Get module dependency tree' })
  @ApiParam({ name: 'name', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Module dependency tree',
    type: ModuleDependencyTreeDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found',
  })
  async getModuleDependencies(@Param('name') name: string): Promise<ModuleDependencyTreeDto> {
    return this.moduleRegistryService.getModuleDependencyTree(name);
  }

  @Delete(':name')
  @Roles('system_admin', 'super_admin')
  @ApiOperation({ summary: 'Delete a module (soft delete)' })
  @ApiParam({ name: 'name', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Module deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot delete core modules or modules with dependencies',
  })
  async deleteModule(@Param('name') name: string): Promise<void> {
    await this.moduleRegistryService.deleteModule(name);
  }
}