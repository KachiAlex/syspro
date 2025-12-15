import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';
import { Payment, PaymentStatus, PaymentGateway } from '../entities/payment.entity';
import { Subscription } from '../entities/subscription.entity';
import { TenantContextService } from '../../../modules/tenant/tenant-context.service';
import { PaymentGatewayFactory } from '../factories/payment-gateway.factory';
import { EventPublisherService } from '../../../shared/events/event-publisher.service';
import { EventType } from '../../../shared/events/event.types';
import { InvoicePdfService } from './invoice-pdf.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    private readonly tenantContext: TenantContextService,
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly eventPublisher: EventPublisherService,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  async createInvoice(
    subscriptionId?: string,
    amountCents?: number,
    description?: string,
    lineItems?: Array<{
      description: string;
      quantity: number;
      unitPriceCents: number;
    }>,
  ): Promise<Invoice> {
    const tenantId = this.tenantContext.requireTenant();

    let subscription: Subscription | null = null;
    if (subscriptionId) {
      subscription = await this.subscriptionRepository.findOne({
        where: { id: subscriptionId, tenantId },
        relations: ['plan'],
      });
    }

    // Calculate amount if not provided
    if (!amountCents && subscription) {
      amountCents = subscription.plan.priceCents;
    }

    if (!amountCents) {
      throw new BadRequestException('Amount is required');
    }

    // Generate invoice number
    const invoiceNumber = this.generateInvoiceNumber();

    const invoice = this.invoiceRepository.create({
      tenantId,
      subscriptionId: subscription?.id,
      invoiceNumber,
      amountDueCents: amountCents,
      amountPaidCents: 0,
      currency: subscription?.plan.currency || 'USD',
      status: InvoiceStatus.DRAFT,
      issuedAt: new Date(),
      dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      lineItems: lineItems || [
        {
          description: description || 'Subscription payment',
          quantity: 1,
          unitPriceCents: amountCents,
          totalCents: amountCents,
        },
      ],
    });

    const saved = await this.invoiceRepository.save(invoice);

    // Generate PDF
    const pdfUrl = await this.invoicePdfService.generateInvoicePdf(saved);
    saved.pdfUrl = pdfUrl;
    await this.invoiceRepository.save(saved);

    // Change status to OPEN
    saved.status = InvoiceStatus.OPEN;
    await this.invoiceRepository.save(saved);

    return saved;
  }

  async recordPayment(
    invoiceId: string,
    gateway: PaymentGateway,
    gatewayChargeId: string,
    amountCents: number,
    metadata?: Record<string, any>,
  ): Promise<Payment> {
    const tenantId = this.tenantContext.requireTenant();
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, tenantId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const payment = this.paymentRepository.create({
      tenantId,
      invoiceId: invoice.id,
      gateway,
      gatewayChargeId, // Should be encrypted in production
      amountCents,
      currency: invoice.currency,
      status: PaymentStatus.SUCCEEDED,
      paidAt: new Date(),
      metadata,
    });

    const saved = await this.paymentRepository.save(payment);

    // Update invoice
    invoice.amountPaidCents += amountCents;
    if (invoice.amountPaidCents >= invoice.amountDueCents) {
      invoice.status = InvoiceStatus.PAID;
      invoice.paidAt = new Date();
    }
    await this.invoiceRepository.save(invoice);

    // Publish event
    await this.eventPublisher.publish('INVOICE.PAID', {
      tenantId,
      invoiceId: invoice.id,
      paymentId: saved.id,
      amount: amountCents,
    });

    return saved;
  }

  async findInvoiceByGatewayId(
    gatewayInvoiceId: string,
    gateway: PaymentGateway,
  ): Promise<Invoice | null> {
    const tenantId = this.tenantContext.requireTenant();
    
    // Try to find invoice by gateway invoice ID stored in metadata
    const invoices = await this.invoiceRepository.find({
      where: { tenantId },
    });

    // Check metadata for gateway invoice ID
    for (const invoice of invoices) {
      const metadata = invoice.metadata as any;
      if (metadata?.gatewayInvoiceId === gatewayInvoiceId) {
        return invoice;
      }
    }

    // Fallback: try to find by invoice number pattern
    return this.invoiceRepository.findOne({
      where: {
        tenantId,
        invoiceNumber: gatewayInvoiceId,
      },
    });
  }

  async getInvoices(
    page: number = 1,
    limit: number = 20,
    status?: InvoiceStatus,
  ) {
    const tenantId = this.tenantContext.requireTenant();
    const skip = (page - 1) * limit;
    const where: any = { tenantId };

    if (status) {
      where.status = status;
    }

    const [invoices, total] = await this.invoiceRepository.findAndCount({
      where,
      relations: ['subscription', 'payments'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getInvoice(invoiceId: string): Promise<Invoice> {
    const tenantId = this.tenantContext.requireTenant();
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, tenantId },
      relations: ['subscription', 'payments'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  private generateInvoiceNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');

    return `INV-${year}${month}${day}-${random}`;
  }
}

