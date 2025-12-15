import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Syscomptech' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'syscomptech.com', required: false })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  settings?: Record<string, any>;

  @ApiProperty({ default: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

