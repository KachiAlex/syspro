import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../../entities/tenant.entity';
import { Subscription } from '../entities/subscription.entity';
import { Invoice } from '../entities/invoice.entity';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../modules/auth/guards/roles.guard';
import { Roles } from '../../../modules/auth/decorators/roles.decorator';
import { UserRole } from '../../../entities/user.entity';
import { BillingService } from '../services/billing.service';

@ApiTags('Billing Tenants')
@ApiBearerAuth()
@Controller('billing/tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.CEO, UserRole.ADMIN, UserRole.FINANCE)
export class TenantsController {
  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    private readonly billingService: BillingService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all tenants with billing info' })
  async findAll(@Query('search') search?: string) {
    const query = this.tenantRepository
      .createQueryBuilder('tenant')
      .leftJoinAndSelect('tenant.userAccesses', 'access')
      .where('tenant.isActive = :isActive', { isActive: true });

    if (search) {
      query.andWhere('(tenant.name ILIKE :search OR tenant.code ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    const tenants = await query.getMany();

    // Enrich with subscription and billing data
    const enriched = await Promise.all(
      tenants.map(async (tenant) => {
        const subscription = await this.subscriptionRepository.findOne({
          where: { tenantId: tenant.id, status: 'active' },
          relations: ['plan'],
        });

        const openInvoices = await this.invoiceRepository.find({
          where: { tenantId: tenant.id, status: 'open' },
        });

        const arBalance = openInvoices.reduce(
          (sum, inv) => sum + (inv.amountDueCents - inv.amountPaidCents),
          0,
        );

        return {
          id: tenant.id,
          name: tenant.name,
          code: tenant.code,
          plan: subscription?.plan,
          status: subscription?.status || 'no_subscription',
          nextBillingDate: subscription?.currentPeriodEnd,
          arBalance,
        };
      }),
    );

    return enriched;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant by ID' })
  async findOne(@Param('id') id: string) {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    return tenant;
  }

  @Get(':tenantId/subscription')
  @ApiOperation({ summary: 'Get tenant subscription' })
  async getSubscription(@Param('tenantId') tenantId: string) {
    return this.subscriptionRepository.findOne({
      where: { tenantId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  @Get(':tenantId/invoices')
  @ApiOperation({ summary: 'Get tenant invoices' })
  async getInvoices(
    @Param('tenantId') tenantId: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const where: any = { tenantId };
    if (status) {
      where.status = status;
    }

    const invoices = await this.invoiceRepository.find({
      where,
      relations: ['subscription', 'payments'],
      order: { createdAt: 'DESC' },
    });

    return { data: invoices };
  }

  @Post(':tenantId/invoices')
  @ApiOperation({ summary: 'Create manual invoice for tenant' })
  async createInvoice(
    @Param('tenantId') tenantId: string,
    @Body() invoiceData: {
      amountCents: number;
      description?: string;
      lineItems?: Array<{
        description: string;
        quantity: number;
        unitPriceCents: number;
      }>;
    },
  ) {
    // Temporarily set tenant context for billing service
    // In production, this should use proper tenant context
    return this.billingService.createInvoice(
      undefined,
      invoiceData.amountCents,
      invoiceData.description,
      invoiceData.lineItems,
    );
  }
}

