import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches } from 'class-validator';
import { VALIDATION } from '@syspro/shared';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'OldPassword123!',
  })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description: 'New password (must contain uppercase, lowercase, number, and special character)',
    example: 'NewSecurePass123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(VALIDATION.PASSWORD_REGEX, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  newPassword: string;
}