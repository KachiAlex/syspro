import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SwitchTenantDto {
  @ApiProperty({ example: 'tenant-uuid' })
  @IsUUID()
  tenantId: string;
}

