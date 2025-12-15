import { IsString, IsOptional, IsEnum, IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RoleScope } from '../entities/role.entity';

export class CreateRoleDto {
  @ApiProperty({ example: 'HR Manager' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'HR_MANAGER', required: false })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: RoleScope, default: RoleScope.TENANT })
  @IsEnum(RoleScope)
  scope: RoleScope;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  moduleId?: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds?: string[];
}

