import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  PaymentGateway,
  CustomerData,
  CreateSubscriptionParams,
  InvoicePayload,
  PaymentMethodToken,
} from '../interfaces/payment-gateway.interface';

@Injectable()
export class StripeAdapter implements PaymentGateway {
  private readonly logger = new Logger(StripeAdapter.name);
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    const apiKey =
      this.configService.get<string>('STRIPE_SECRET_KEY') ||
      'sk_test_placeholder';

    this.stripe = new Stripe(apiKey, {
      apiVersion: '2024-11-20.acacia',
    });
  }

  getName(): string {
    return 'STRIPE';
  }

  async createCustomer(
    tenantId: string,
    customerData: CustomerData,
  ): Promise<{ id: string }> {
    const customer = await this.stripe.customers.create({
      email: customerData.email,
      name: customerData.name,
      phone: customerData.phone,
      metadata: {
        tenantId,
        ...customerData.metadata,
      },
    });

    return { id: customer.id };
  }

  async createSubscription(
    params: CreateSubscriptionParams,
  ): Promise<{
    id: string;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  }> {
    const subscriptionParams: Stripe.SubscriptionCreateParams = {
      customer: params.customerId,
      items: [{ price: params.planId }],
      metadata: params.metadata,
    };

    if (params.trialEnd) {
      subscriptionParams.trial_end = Math.floor(
        params.trialEnd.getTime() / 1000,
      );
    }

    const subscription = await this.stripe.subscriptions.create(
      subscriptionParams,
    );

    return {
      id: subscription.id,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    };
  }

  async createInvoice(invoicePayload: InvoicePayload): Promise<{
    id: string;
    pdfUrl?: string;
    status: string;
  }> {
    // Create invoice item
    if (invoicePayload.lineItems) {
      for (const item of invoicePayload.lineItems) {
        await this.stripe.invoiceItems.create({
          customer: invoicePayload.customerId,
          amount: item.unitPriceCents,
          quantity: item.quantity,
          description: item.description,
        });
      }
    }

    // Create and finalize invoice
    const invoice = await this.stripe.invoices.create({
      customer: invoicePayload.customerId,
      auto_advance: true,
      metadata: invoicePayload.metadata,
    });

    const finalizedInvoice = await this.stripe.invoices.finalizeInvoice(
      invoice.id,
    );

    return {
      id: finalizedInvoice.id,
      pdfUrl: finalizedInvoice.invoice_pdf || undefined,
      status: finalizedInvoice.status || 'open',
    };
  }

  async retrieveInvoice(invoiceId: string): Promise<{
    id: string;
    status: string;
    amountPaid: number;
    amountDue: number;
    pdfUrl?: string;
  }> {
    const invoice = await this.stripe.invoices.retrieve(invoiceId);

    return {
      id: invoice.id,
      status: invoice.status || 'open',
      amountPaid: invoice.amount_paid,
      amountDue: invoice.amount_due,
      pdfUrl: invoice.invoice_pdf || undefined,
    };
  }

  async payInvoice(
    invoiceId: string,
    paymentMethodToken: PaymentMethodToken,
  ): Promise<{
    id: string;
    status: string;
    amount: number;
  }> {
    const invoice = await this.stripe.invoices.retrieve(invoiceId);

    if (paymentMethodToken.type === 'card') {
      await this.stripe.invoices.pay(invoiceId, {
        payment_method: paymentMethodToken.token,
      });
    }

    const updatedInvoice = await this.stripe.invoices.retrieve(invoiceId);

    return {
      id: updatedInvoice.id,
      status: updatedInvoice.status || 'open',
      amount: updatedInvoice.amount_paid,
    };
  }

  async refundPayment(
    paymentId: string,
    amountCents?: number,
  ): Promise<{
    id: string;
    status: string;
    amount: number;
  }> {
    const refundParams: Stripe.RefundCreateParams = {
      charge: paymentId,
    };

    if (amountCents) {
      refundParams.amount = amountCents;
    }

    const refund = await this.stripe.refunds.create(refundParams);

    return {
      id: refund.id,
      status: refund.status,
      amount: refund.amount,
    };
  }

  verifyWebhook(signatureHeader: string, payload: string): boolean {
    const webhookSecret =
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ||
      'whsec_placeholder';

    try {
      this.stripe.webhooks.constructEvent(payload, signatureHeader, webhookSecret);
      return true;
    } catch (error) {
      this.logger.error('Stripe webhook verification failed', error);
      return false;
    }
  }
}

