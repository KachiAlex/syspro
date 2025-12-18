import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private getRefreshCookieOptions() {
    const maxAgeDays = Number(process.env.REFRESH_COOKIE_MAXAGE_DAYS || '7');
    const path = process.env.REFRESH_COOKIE_PATH || '/api/auth/refresh';
    const sameSiteRaw = (process.env.REFRESH_COOKIE_SAMESITE || 'lax').toLowerCase();

    const sameSite =
      sameSiteRaw === 'none' || sameSiteRaw === 'strict' || sameSiteRaw === 'lax'
        ? sameSiteRaw
        : 'lax';

    const secureEnv = process.env.REFRESH_COOKIE_SECURE;
    const secure =
      secureEnv === undefined
        ? process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)
        : secureEnv === 'true' || secureEnv === '1';

    const domain = process.env.REFRESH_COOKIE_DOMAIN;

    return {
      httpOnly: true as const,
      secure,
      sameSite: sameSite as 'lax' | 'strict' | 'none',
      path,
      maxAge: maxAgeDays * 24 * 60 * 60 * 1000,
      ...(domain ? { domain } : {}),
    };
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie('refreshToken', refreshToken, this.getRefreshCookieOptions());
  }

  private clearRefreshCookie(res: Response) {
    const { maxAge, ...options } = this.getRefreshCookieOptions();
    res.clearCookie('refreshToken', options);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto);
    this.setRefreshCookie(res, result.refreshToken);
    const { refreshToken, ...body } = result;
    return body;
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'User registration' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(registerDto);
    this.setRefreshCookie(res, result.refreshToken);
    const { refreshToken, ...body } = result;
    return body;
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const user = req.user;
    const tokens = await this.authService.generateTokensForUser(
      user,
      user?.tenantId || user?.organizationId,
    );
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout (clears refresh cookie)' })
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(@Res({ passthrough: true }) res: Response) {
    this.clearRefreshCookie(res);
    return { message: 'Logged out' };
  }
}

