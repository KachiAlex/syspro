import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';
import { Payment } from '../entities/payment.entity';
import { Subscription } from '../entities/subscription.entity';
import { TenantContextService } from '../../../modules/tenant/tenant-context.service';

export interface RevenueReport {
  totalRevenue: number;
  paidInvoices: number;
  outstandingInvoices: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface ARReport {
  current: number; // 0-30 days
  days31_60: number;
  days61_90: number;
  over90: number;
  total: number;
}

@Injectable()
export class ReportingService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async getRevenueReport(
    startDate: Date,
    endDate: Date,
  ): Promise<RevenueReport> {
    const tenantId = this.tenantContext.getTenant();

    const where: any = {
      createdAt: Between(startDate, endDate),
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const [paidInvoices, outstandingInvoices] = await Promise.all([
      this.invoiceRepository.find({
        where: { ...where, status: InvoiceStatus.PAID },
      }),
      this.invoiceRepository.find({
        where: { ...where, status: InvoiceStatus.OPEN },
      }),
    ]);

    const totalRevenue = paidInvoices.reduce(
      (sum, inv) => sum + inv.amountPaidCents,
      0,
    );

    const outstandingAmount = outstandingInvoices.reduce(
      (sum, inv) => sum + inv.amountDueCents - inv.amountPaidCents,
      0,
    );

    return {
      totalRevenue: totalRevenue / 100,
      paidInvoices: paidInvoices.length,
      outstandingInvoices: outstandingAmount / 100,
      periodStart: startDate,
      periodEnd: endDate,
    };
  }

  async getARReport(): Promise<ARReport> {
    const tenantId = this.tenantContext.getTenant();
    const now = new Date();

    const where: any = {
      status: InvoiceStatus.OPEN,
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const openInvoices = await this.invoiceRepository.find({ where });

    let current = 0;
    let days31_60 = 0;
    let days61_90 = 0;
    let over90 = 0;

    openInvoices.forEach((invoice) => {
      const daysPastDue = Math.floor(
        (now.getTime() - invoice.dueAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      const amount = invoice.amountDueCents - invoice.amountPaidCents;

      if (daysPastDue <= 30) {
        current += amount;
      } else if (daysPastDue <= 60) {
        days31_60 += amount;
      } else if (daysPastDue <= 90) {
        days61_90 += amount;
      } else {
        over90 += amount;
      }
    });

    return {
      current: current / 100,
      days31_60: days31_60 / 100,
      days61_90: days61_90 / 100,
      over90: over90 / 100,
      total: (current + days31_60 + days61_90 + over90) / 100,
    };
  }

  async getMRR(): Promise<number> {
    const tenantId = this.tenantContext.getTenant();
    const where: any = { status: 'active' };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const subscriptions = await this.subscriptionRepository.find({
      where,
      relations: ['plan'],
    });

    const mrr = subscriptions.reduce((sum, sub) => {
      if (sub.plan.billingCycle === 'MONTHLY') {
        return sum + sub.plan.priceCents;
      } else {
        // Annual plan: divide by 12
        return sum + sub.plan.priceCents / 12;
      }
    }, 0);

    return mrr / 100;
  }

  async getARR(): Promise<number> {
    const tenantId = this.tenantContext.getTenant();
    const where: any = { status: 'active' };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const subscriptions = await this.subscriptionRepository.find({
      where,
      relations: ['plan'],
    });

    const arr = subscriptions.reduce((sum, sub) => {
      if (sub.plan.billingCycle === 'YEARLY') {
        return sum + sub.plan.priceCents;
      } else {
        // Monthly plan: multiply by 12
        return sum + sub.plan.priceCents * 12;
      }
    }, 0);

    return arr / 100;
  }
}

