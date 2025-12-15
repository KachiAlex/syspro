import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from './config.service';
import { ConfigScope } from './entities/config.entity';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { Roles } from '../../modules/auth/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';

@ApiTags('Configuration')
@ApiBearerAuth()
@Controller('config')
@UseGuards(JwtAuthGuard)
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Set configuration value' })
  async setConfig(
    @Body() body: {
      key: string;
      value: any;
      scope?: ConfigScope;
      moduleId?: string;
      description?: string;
    },
  ) {
    return this.configService.setConfig(
      body.key,
      body.value,
      body.scope,
      body.moduleId,
      body.description,
    );
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get configuration value' })
  async getConfig(
    @Param('key') key: string,
    @Query('scope') scope?: ConfigScope,
    @Query('moduleId') moduleId?: string,
  ) {
    const value = await this.configService.getConfig(key, scope, moduleId);
    return { key, value };
  }

  @Get()
  @ApiOperation({ summary: 'Get all configurations' })
  async getAllConfigs(
    @Query('scope') scope?: ConfigScope,
    @Query('moduleId') moduleId?: string,
  ) {
    return this.configService.getAllConfigs(scope, moduleId);
  }

  @Delete(':key')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete configuration' })
  async deleteConfig(
    @Param('key') key: string,
    @Query('scope') scope?: ConfigScope,
  ) {
    await this.configService.deleteConfig(key, scope);
    return { message: 'Configuration deleted successfully' };
  }

  @Post('features')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create feature flag' })
  async createFeatureFlag(
    @Body() body: { key: string; name: string; description?: string },
  ) {
    return this.configService.createFeatureFlag(
      body.key,
      body.name,
      body.description,
    );
  }

  @Post('features/:key/toggle')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Toggle feature flag' })
  async toggleFeatureFlag(
    @Param('key') key: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.configService.toggleFeatureFlag(key, body.enabled);
  }

  @Get('features/:key')
  @ApiOperation({ summary: 'Check if feature is enabled' })
  async isFeatureEnabled(@Param('key') key: string) {
    const enabled = await this.configService.isFeatureEnabled(key);
    return { key, enabled };
  }
}

