import { IsOptional, IsString, IsBoolean, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTenantDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

