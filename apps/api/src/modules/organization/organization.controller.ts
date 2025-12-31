import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@ApiTags('Organizations')
@ApiBearerAuth('JWT-auth')
@Controller({ path: 'organizations', version: '1' })
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @ApiOperation({ summary: 'Get organizations for current tenant' })
  async getOrganizations(@CurrentTenant() tenantId: string) {
    return this.organizationService.findByTenant(tenantId);
  }

  // Additional organization endpoints will be implemented here
}