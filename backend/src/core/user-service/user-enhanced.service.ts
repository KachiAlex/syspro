import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { User } from '../../entities/user.entity';
import { UsersService } from '../../modules/users/users.service';
import { UserActivityService } from './user-activity.service';
import { ActivityType } from './entities/user-activity.entity';
import { ChangePasswordDto } from './dto/password-reset.dto';
import { EventPublisherService } from '../../shared/events/event-publisher.service';
import { EventType } from '../../shared/events/event.types';

@Injectable()
export class UserEnhancedService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private usersService: UsersService,
    private activityService: UserActivityService,
    private eventPublisher: EventPublisherService,
  ) {}

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const user = await this.usersService.findOne(userId);

    const isCurrentPasswordValid = await user.validatePassword(
      changePasswordDto.currentPassword,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password with Argon2
    const hashedPassword = await argon2.hash(changePasswordDto.newPassword);

    await this.userRepository.update(userId, {
      password: hashedPassword,
    });

    // Log activity
    await this.activityService.logActivity(
      userId,
      ActivityType.PASSWORD_CHANGED,
      'User changed password',
      {},
      ipAddress,
      userAgent,
    );

    // Publish event
    await this.eventPublisher.publish(EventType.USER_PASSWORD_CHANGED, {
      userId,
      tenantId: user.tenantId,
    });
  }

  async enable2FA(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await this.usersService.findOne(userId);

    if (user.mfaEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    const secret = speakeasy.generateSecret({
      name: `Syspro ERP (${user.email})`,
      issuer: 'Syspro ERP',
    });

    // Store secret temporarily (user needs to verify before enabling)
    await this.userRepository.update(userId, {
      mfaSecret: secret.base32,
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,
      qrCode,
    };
  }

  async verifyAndEnable2FA(
    userId: string,
    token: string,
  ): Promise<{ verified: boolean }> {
    const user = await this.usersService.findOne(userId);

    if (!user.mfaSecret) {
      throw new BadRequestException('2FA setup not initiated');
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (verified) {
      await this.userRepository.update(userId, {
        mfaEnabled: true,
      });

      await this.activityService.logActivity(
        userId,
        ActivityType.TWO_FA_ENABLED,
        'User enabled 2FA',
      );

      await this.eventPublisher.publish(EventType.USER_2FA_ENABLED, {
        userId,
        tenantId: user.tenantId,
      });
    }

    return { verified };
  }

  async disable2FA(userId: string, token: string): Promise<void> {
    const user = await this.usersService.findOne(userId);

    if (!user.mfaEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    if (!user.mfaSecret) {
      throw new BadRequestException('2FA secret not found');
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      throw new UnauthorizedException('Invalid 2FA token');
    }

    await this.userRepository.update(userId, {
      mfaEnabled: false,
      mfaSecret: null,
    });

    await this.activityService.logActivity(
      userId,
      ActivityType.TWO_FA_DISABLED,
      'User disabled 2FA',
    );

    await this.eventPublisher.publish(EventType.USER_2FA_DISABLED, {
      userId,
      tenantId: user.tenantId,
    });
  }

  async verify2FA(userId: string, token: string): Promise<boolean> {
    const user = await this.usersService.findOne(userId);

    if (!user.mfaEnabled || !user.mfaSecret) {
      return false;
    }

    return speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 2,
    });
  }

  async updateProfile(
    userId: string,
    updates: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      avatar?: string;
    },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<User> {
    const user = await this.usersService.update(userId, updates);

    await this.activityService.logActivity(
      userId,
      ActivityType.PROFILE_UPDATED,
      'User updated profile',
      { updates },
      ipAddress,
      userAgent,
    );

    return user;
  }
}

