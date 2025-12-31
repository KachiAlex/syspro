import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@ApiTags('Tenants')
@ApiBearerAuth('JWT-auth')
@Controller({ path: 'tenants', version: '1' })
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current tenant information' })
  async getCurrentTenant(@CurrentTenant() tenantId: string) {
    return this.tenantService.findById(tenantId);
  }

  // Additional tenant endpoints will be implemented here
}