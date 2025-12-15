import { IsEmail, IsString, MinLength, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../entities/user.entity';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ enum: UserRole, example: UserRole.EMPLOYEE })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({ example: 'organization-id-uuid' })
  @IsUUID()
  organizationId: string;

  @ApiProperty({ example: 'subsidiary-id-uuid', required: false })
  @IsOptional()
  @IsUUID()
  subsidiaryId?: string;

  @ApiProperty({ example: 'department-id-uuid', required: false })
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

