import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { IdempotencyService } from '../../utils/idempotency';

@Injectable()
export class StripeWebhookHandler {
  private readonly logger = new Logger(StripeWebhookHandler.name);
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(
    private configService: ConfigService,
    private idempotencyService: IdempotencyService,
  ) {
    const apiKey =
      this.configService.get<string>('STRIPE_SECRET_KEY') ||
      'sk_test_placeholder';

    this.stripe = new Stripe(apiKey, {
      apiVersion: '2024-11-20.acacia',
    });

    this.webhookSecret =
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ||
      'whsec_placeholder';
  }

  async handleWebhook(
    payload: string,
    signature: string,
  ): Promise<{ processed: boolean; event?: any }> {
    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret,
      );
    } catch (error: any) {
      this.logger.error('Stripe webhook signature verification failed', error.message);
      throw new BadRequestException('Invalid webhook signature');
    }

    // Check idempotency
    const isProcessed = await this.idempotencyService.isProcessed(
      'STRIPE',
      event.id,
    );

    if (isProcessed) {
      this.logger.log(`Event ${event.id} already processed, skipping`);
      return { processed: false };
    }

    // Mark as processed
    await this.idempotencyService.markProcessed(
      'STRIPE',
      event.id,
      event.type,
      event,
    );

    // Map Stripe events to internal events
    const mappedEvent = this.mapStripeEvent(event);

    return {
      processed: true,
      event: mappedEvent,
    };
  }

  private mapStripeEvent(event: Stripe.Event): any {
    switch (event.type) {
      case 'invoice.payment_succeeded':
        return {
          type: 'INVOICE.PAID',
          data: {
            invoiceId: (event.data.object as Stripe.Invoice).id,
            amount: (event.data.object as Stripe.Invoice).amount_paid,
            currency: (event.data.object as Stripe.Invoice).currency,
            customerId: (event.data.object as Stripe.Invoice).customer,
            gateway: 'STRIPE',
            gatewayChargeId: (event.data.object as Stripe.Invoice).charge,
          },
        };

      case 'invoice.payment_failed':
        return {
          type: 'INVOICE.FAILED',
          data: {
            invoiceId: (event.data.object as Stripe.Invoice).id,
            amount: (event.data.object as Stripe.Invoice).amount_due,
            currency: (event.data.object as Stripe.Invoice).currency,
            customerId: (event.data.object as Stripe.Invoice).customer,
            gateway: 'STRIPE',
            failureReason: (event.data.object as Stripe.Invoice).last_payment_error?.message,
          },
        };

      case 'customer.subscription.updated':
        return {
          type: 'SUBSCRIPTION.UPDATED',
          data: {
            subscriptionId: (event.data.object as Stripe.Subscription).id,
            status: (event.data.object as Stripe.Subscription).status,
            customerId: (event.data.object as Stripe.Subscription).customer,
            gateway: 'STRIPE',
          },
        };

      case 'customer.subscription.deleted':
        return {
          type: 'SUBSCRIPTION.CANCELED',
          data: {
            subscriptionId: (event.data.object as Stripe.Subscription).id,
            customerId: (event.data.object as Stripe.Subscription).customer,
            gateway: 'STRIPE',
          },
        };

      default:
        this.logger.log(`Unhandled Stripe event type: ${event.type}`);
        return null;
    }
  }

  verifyWebhook(signature: string, payload: string): boolean {
    try {
      this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
      return true;
    } catch {
      return false;
    }
  }
}

