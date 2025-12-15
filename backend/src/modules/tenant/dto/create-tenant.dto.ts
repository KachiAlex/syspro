import { IsString, IsOptional, IsBoolean, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ example: 'Syscomptech Main' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'SYSCOMPTECH' })
  @IsString()
  @MinLength(2)
  code: string;

  @ApiProperty({ default: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

