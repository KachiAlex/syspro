import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { User } from '@syspro/database';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller({ path: 'users', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user details' })
  async getCurrentUser(
    @CurrentUser() user: User,
    @CurrentTenant() tenantId: string,
  ) {
    return this.userService.findById(user.id, tenantId);
  }

  // Additional user endpoints will be implemented here
}