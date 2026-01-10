import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { User, Tenant, UserRole, UserStatus } from '@syspro/database';
import { AuthTokens, AuthUser } from '@syspro/shared';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class AuthService {
  private static isUuid(value: string): boolean {
    return UUID_REGEX.test(value);
  }

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(UserRole)
    private readonly roleRepository: Repository<UserRole>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private readonly logger = new Logger(AuthService.name);

  async validateUser(email: string, password: string, tenantId: string): Promise<User | null> {
    this.logger.debug(`Validating user ${email} for tenant ${tenantId}`);
    const user = await this.userRepository.findOne({
      where: { email, tenantId },
      relations: ['tenant', 'roles', 'roles.permissions'],
    });

    if (!user) {
      this.logger.warn(`User ${email} not found for tenant ${tenantId}`);
      return null;
    }

    // Check if user can login
    if (!user.canLogin) {
      this.logger.warn(
        `User ${email} for tenant ${tenantId} cannot login (status=${user.status}, isActive=${user.isActive}, emailVerified=${user.emailVerified}, locked=${user.isLocked})`,
      );
      throw new UnauthorizedException('Account is not active or verified');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Invalid password for user ${email} (tenant ${tenantId})`);
      // Increment failed login attempts
      user.incrementFailedLoginAttempts();
      await this.userRepository.save(user);
      return null;
    }

    // Reset failed login attempts on successful login
    user.resetFailedLoginAttempts();
    await this.userRepository.save(user);

    return user;
  }

  async login(loginDto: LoginDto, tenantId: string): Promise<AuthTokens> {
    const user = await this.validateUser(loginDto.email, loginDto.password, tenantId);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user);
  }

  async platformLogin(loginDto: LoginDto): Promise<AuthTokens> {
    try {
      const platformTenantCode = this.configService.get<string>('app.platformTenantCode') || 'PLATFORM';

      this.logger.log(`Platform login attempt for ${loginDto.email}`);
      let platformTenant = await this.tenantRepository.findOne({
        where: { code: platformTenantCode, isActive: true },
      });

      if (
        !platformTenant &&
        AuthService.isUuid(platformTenantCode)
      ) {
        platformTenant = await this.tenantRepository.findOne({
          where: { id: platformTenantCode, isActive: true },
        });
      }

      if (!platformTenant) {
        platformTenant = await this.tenantRepository.findOne({
          where: { name: platformTenantCode, isActive: true },
        });
      }

      if (!platformTenant) {
        this.logger.error(`Platform tenant "${platformTenantCode}" not found or inactive`);
        throw new UnauthorizedException('Platform tenant not configured');
      }

      this.logger.debug(`Using platform tenant ${platformTenant.id} (${platformTenant.code})`);
      return this.login(loginDto, platformTenant.id);
    } catch (error) {
      this.logger.error(
        `Platform login failed for ${loginDto.email}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async register(registerDto: RegisterDto, tenantId: string): Promise<AuthTokens> {
    // Check if tenant exists and is active
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId, isActive: true },
    });

    if (!tenant) {
      throw new BadRequestException('Invalid or inactive tenant');
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email, tenantId },
    });

    if (existingUser) {
      throw new ConflictException('User already exists with this email');
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(registerDto.password, saltRounds);

    // Get default role for new users
    const defaultRole = await this.roleRepository.findOne({
      where: { tenantId, name: 'User' },
    });

    // Create user
    const user = this.userRepository.create({
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      password: hashedPassword,
      tenantId,
      status: UserStatus.PENDING_VERIFICATION,
      roles: defaultRole ? [defaultRole] : [],
    });

    const savedUser = await this.userRepository.save(user);

    // Generate email verification token (implement email service later)
    // await this.emailService.sendVerificationEmail(savedUser);

    return this.generateTokens(savedUser);
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify(refreshTokenDto.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
        relations: ['tenant', 'roles', 'roles.permissions'],
      });

      if (!user || !user.canLogin) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, saltRounds);

    // Update password
    user.password = hashedPassword;
    await this.userRepository.save(user);
  }

  async verifyEmail(token: string): Promise<void> {
    // Implement email verification logic
    // This would typically decode a JWT token and update user's emailVerified status
    throw new Error('Email verification not implemented yet');
  }

  async forgotPassword(email: string, tenantId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { email, tenantId },
    });

    if (!user) {
      // Don't reveal if user exists or not
      return;
    }

    // Generate password reset token
    const resetToken = this.jwtService.sign(
      { sub: user.id, type: 'password-reset' },
      {
        secret: this.configService.get<string>('jwt.passwordResetSecret'),
        expiresIn: this.configService.get<string>('jwt.passwordResetExpiresIn'),
      },
    );

    // Save reset token to user (implement email service later)
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.userRepository.save(user);

    // Send password reset email
    // await this.emailService.sendPasswordResetEmail(user, resetToken);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.passwordResetSecret'),
      });

      const user = await this.userRepository.findOne({
        where: { 
          id: payload.sub,
          passwordResetToken: token,
        },
      });

      if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password and clear reset token
      user.password = hashedPassword;
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await this.userRepository.save(user);
    } catch (error) {
      throw new BadRequestException('Invalid or expired reset token');
    }
  }

  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles?.map(role => role.name) || [],
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: this.configService.get<string>('jwt.expiresIn'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpirationTime(this.configService.get<string>('jwt.expiresIn')),
    };
  }

  private parseExpirationTime(expiresIn: string): number {
    // Convert JWT expiration string to seconds
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1));

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 24 * 60 * 60; // Default to 24 hours
    }
  }

  async getUserProfile(userId: string): Promise<AuthUser> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['tenant', 'roles', 'roles.permissions'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const permissions = user.roles?.flatMap(role => 
      role.permissions?.map(permission => `${permission.resource}:${permission.action}`) || []
    ) || [];

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tenantId: user.tenantId,
      roles: user.roles?.map(role => role.name) || [],
      permissions: [...new Set(permissions)], // Remove duplicates
    };
  }
}