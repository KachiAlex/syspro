import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { VALIDATION } from '@syspro/shared';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@acme.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
    minLength: 1,
    maxLength: 50,
  })
  @IsString()
  @MinLength(1, { message: 'First name is required' })
  @MaxLength(50, { message: 'First name must not exceed 50 characters' })
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    minLength: 1,
    maxLength: 50,
  })
  @IsString()
  @MinLength(1, { message: 'Last name is required' })
  @MaxLength(50, { message: 'Last name must not exceed 50 characters' })
  lastName: string;

  @ApiProperty({
    description: 'User password (must contain uppercase, lowercase, number, and special character)',
    example: 'SecurePass123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(VALIDATION.PASSWORD_REGEX, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;
}