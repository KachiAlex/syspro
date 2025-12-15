// Controller to expose seed endpoint
import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { createAdminViaAPI } from './create-admin-api';

@ApiTags('Platform Setup')
@Controller('platform')
export class PlatformSetupController {
  @Post('seed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Initialize platform with admin user and default plans',
    description: 'Creates super admin, subscription plans, and demo tenant. Can only be run once.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Platform initialized successfully',
    schema: {
      example: {
        success: true,
        message: 'Platform seeded successfully',
        credentials: {
          email: 'admin@syspro.com',
          password: 'Admin@123',
          warning: 'CHANGE THIS PASSWORD IMMEDIATELY!'
        }
      }
    }
  })
  @ApiResponse({ status: 500, description: 'Seed failed' })
  async seedPlatform() {
    try {
      const result = await createAdminViaAPI();
      return result;
    } catch (error) {
      return {
        success: false,
        message: 'Seed failed',
        error: error.message,
      };
    }
  }
}

