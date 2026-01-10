import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('api/v1/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get dashboard summary for the current tenant' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard summary returned successfully',
    type: DashboardSummaryDto,
  })
  async getDashboardSummary(@CurrentTenant() tenantId: string): Promise<DashboardSummaryDto> {
    return this.dashboardService.getDashboardSummary(tenantId);
  }
}
