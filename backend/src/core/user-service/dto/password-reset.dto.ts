import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestPasswordResetDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ example: 'newPassword123' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'currentPassword123' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'newPassword123' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

