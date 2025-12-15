import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserEnhancedService } from './user-enhanced.service';
import { UserActivityService } from './user-activity.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { ChangePasswordDto } from './dto/password-reset.dto';
import { Enable2FADto, Verify2FADto } from './dto/enable-2fa.dto';
import { Pagination } from '../../shared/decorators/pagination.decorator';
import { PaginationQuery } from '../../shared/decorators/pagination.decorator';

@ApiTags('User Enhanced')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserEnhancedController {
  constructor(
    private readonly userEnhancedService: UserEnhancedService,
    private readonly activityService: UserActivityService,
  ) {}

  @Get('me/profile')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user: User) {
    return user;
  }

  @Patch('me/profile')
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(
    @CurrentUser() user: User,
    @Body() updates: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      avatar?: string;
    },
    @Req() req: any,
  ) {
    return this.userEnhancedService.updateProfile(
      user.id,
      updates,
      req.ip,
      req.get('user-agent'),
    );
  }

  @Post('me/change-password')
  @ApiOperation({ summary: 'Change user password' })
  async changePassword(
    @CurrentUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: any,
  ) {
    await this.userEnhancedService.changePassword(
      user.id,
      changePasswordDto,
      req.ip,
      req.get('user-agent'),
    );
    return { message: 'Password changed successfully' };
  }

  @Post('me/2fa/enable')
  @ApiOperation({ summary: 'Initiate 2FA setup' })
  async enable2FA(@CurrentUser() user: User) {
    return this.userEnhancedService.enable2FA(user.id);
  }

  @Post('me/2fa/verify')
  @ApiOperation({ summary: 'Verify and enable 2FA' })
  async verifyAndEnable2FA(
    @CurrentUser() user: User,
    @Body() verifyDto: Verify2FADto,
  ) {
    return this.userEnhancedService.verifyAndEnable2FA(user.id, verifyDto.token);
  }

  @Post('me/2fa/disable')
  @ApiOperation({ summary: 'Disable 2FA' })
  async disable2FA(@CurrentUser() user: User, @Body() verifyDto: Verify2FADto) {
    await this.userEnhancedService.disable2FA(user.id, verifyDto.token);
    return { message: '2FA disabled successfully' };
  }

  @Get('me/activities')
  @ApiOperation({ summary: 'Get user activity logs' })
  async getActivities(
    @CurrentUser() user: User,
    @Pagination() pagination: PaginationQuery,
  ) {
    return this.activityService.getUserActivities(
      user.id,
      pagination.page,
      pagination.limit,
    );
  }
}

