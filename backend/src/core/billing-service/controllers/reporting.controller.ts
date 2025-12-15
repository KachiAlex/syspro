import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportingService } from '../services/reporting.service';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../modules/auth/guards/roles.guard';
import { Roles } from '../../../modules/auth/decorators/roles.decorator';
import { UserRole } from '../../../entities/user.entity';

@ApiTags('Billing Reports')
@ApiBearerAuth()
@Controller('billing/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.CEO, UserRole.ADMIN, UserRole.FINANCE)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('revenue')
  @ApiOperation({ summary: 'Get revenue report' })
  async getRevenueReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportingService.getRevenueReport(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('ar')
  @ApiOperation({ summary: 'Get accounts receivable aging report' })
  async getARReport() {
    return this.reportingService.getARReport();
  }

  @Get('mrr')
  @ApiOperation({ summary: 'Get Monthly Recurring Revenue' })
  async getMRR() {
    const mrr = await this.reportingService.getMRR();
    return { mrr };
  }

  @Get('arr')
  @ApiOperation({ summary: 'Get Annual Recurring Revenue' })
  async getARR() {
    const arr = await this.reportingService.getARR();
    return { arr };
  }
}

