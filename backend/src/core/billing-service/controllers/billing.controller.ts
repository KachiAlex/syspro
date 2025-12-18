import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { BillingService } from '../services/billing.service';
import { SubscriptionService } from '../services/subscription.service';
import { MeteringService } from '../services/metering.service';
import { LicensingService } from '../services/licensing.service';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../modules/auth/guards/roles.guard';
import { Roles } from '../../../modules/auth/decorators/roles.decorator';
import { UserRole } from '../../../entities/user.entity';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  private readonly storagePath: string;

  constructor(
    private readonly billingService: BillingService,
    private readonly subscriptionService: SubscriptionService,
    private readonly meteringService: MeteringService,
    private readonly licensingService: LicensingService,
    private readonly configService: ConfigService,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
  ) {
    this.storagePath = this.configService.get<string>(
      'INVOICE_STORAGE_PATH',
      path.join(process.cwd(), 'storage', 'invoices'),
    );
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Get current subscription' })
  async getCurrentSubscription() {
    return this.subscriptionService.getCurrentSubscription();
  }

  @Post('subscription')
  @ApiOperation({ summary: 'Create subscription' })
  async createSubscription(
    @Body() body: { planId: string; gateway?: string; trialDays?: number },
  ) {
    return this.subscriptionService.createSubscription(
      body.planId,
      body.gateway,
      body.trialDays,
    );
  }

  @Post('subscription/:id/upgrade')
  @ApiOperation({ summary: 'Upgrade subscription' })
  async upgradeSubscription(
    @Param('id') id: string,
    @Body() body: { newPlanId: string },
  ) {
    return this.subscriptionService.upgradeSubscription(id, body.newPlanId);
  }

  @Post('subscription/:id/cancel')
  @ApiOperation({ summary: 'Cancel subscription' })
  async cancelSubscription(
    @Param('id') id: string,
    @Body() body: { cancelAtPeriodEnd?: boolean },
  ) {
    return this.subscriptionService.cancelSubscription(
      id,
      body.cancelAtPeriodEnd !== false,
    );
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Get invoices' })
  async getInvoices(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: InvoiceStatus,
  ) {
    return this.billingService.getInvoices(
      page ? parseInt(page.toString(), 10) : 1,
      limit ? parseInt(limit.toString(), 10) : 20,
      status,
    );
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  async getInvoice(@Param('id') id: string) {
    return this.billingService.getInvoice(id);
  }

  @Post('metering/events')
  @ApiOperation({ summary: 'Record metering event' })
  async recordEvent(
    @Body() body: { eventType: string; value?: number; meta?: Record<string, any> },
  ) {
    return this.meteringService.recordEvent(
      body.eventType,
      body.value,
      body.meta,
    );
  }

  @Get('metering/usage')
  @ApiOperation({ summary: 'Get current period usage' })
  async getUsage() {
    return this.meteringService.getCurrentPeriodUsage();
  }

  @Get('licenses')
  @ApiOperation({ summary: 'Get licenses' })
  async getLicenses() {
    return this.licensingService.getLicenses();
  }

  @Post('licenses/:moduleKey/enable')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CEO)
  @ApiOperation({ summary: 'Enable module license' })
  async enableModule(
    @Param('moduleKey') moduleKey: string,
    @Body() body: { quota?: number; expiresAt?: Date },
  ) {
    return this.licensingService.enableModule(
      moduleKey,
      body.quota,
      body.expiresAt,
    );
  }

  @Post('licenses/:moduleKey/disable')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CEO)
  @ApiOperation({ summary: 'Disable module license' })
  async disableModule(@Param('moduleKey') moduleKey: string) {
    await this.licensingService.disableModule(moduleKey);
    return { message: 'Module disabled successfully' };
  }

  @Get('invoices/:id/pdf')
  @ApiOperation({ summary: 'Download invoice PDF' })
  async downloadInvoicePdf(@Param('id') id: string, @Res() res: Response) {
    const invoice = await this.invoiceRepository.findOne({ where: { id } });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const filePath = path.join(
      this.storagePath,
      invoice.tenantId,
      `${invoice.id}.pdf`,
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'PDF not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    );

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }
}

