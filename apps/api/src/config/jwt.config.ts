import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'syspro-jwt-secret-change-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'syspro-refresh-secret-change-in-production',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  
  // Password reset
  passwordResetSecret: process.env.JWT_PASSWORD_RESET_SECRET || 'syspro-password-reset-secret',
  passwordResetExpiresIn: process.env.JWT_PASSWORD_RESET_EXPIRES_IN || '1h',
  
  // Email verification
  emailVerificationSecret: process.env.JWT_EMAIL_VERIFICATION_SECRET || 'syspro-email-verification-secret',
  emailVerificationExpiresIn: process.env.JWT_EMAIL_VERIFICATION_EXPIRES_IN || '24h',
}));