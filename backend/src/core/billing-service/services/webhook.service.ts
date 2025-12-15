import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PaymentGatewayFactory } from '../factories/payment-gateway.factory';
import { BillingService } from './billing.service';
import { SubscriptionService } from './subscription.service';
import { EventPublisherService } from '../../../shared/events/event-publisher.service';
import { PaymentGateway } from '../entities/payment.entity';
import { IdempotencyService } from '../utils/idempotency';
import { StripeWebhookHandler } from '../adapters/stripe/stripe.webhook';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly billingService: BillingService,
    private readonly subscriptionService: SubscriptionService,
    private readonly eventPublisher: EventPublisherService,
    private readonly idempotencyService: IdempotencyService,
    private readonly stripeWebhookHandler: StripeWebhookHandler,
  ) {}

  async handleStripeWebhook(payload: any, signature: string): Promise<void> {
    // Use StripeWebhookHandler for proper verification and idempotency
    const result = await this.stripeWebhookHandler.handleWebhook(
      JSON.stringify(payload),
      signature,
    );

    if (!result.processed || !result.event) {
      return; // Already processed or invalid
    }

    const event = result.event;

    switch (event.type) {
      case 'INVOICE.PAID':
        await this.handlePaymentSucceeded('STRIPE', event.data);
        break;
      case 'INVOICE.FAILED':
        await this.handlePaymentFailed('STRIPE', event.data);
        break;
      case 'SUBSCRIPTION.UPDATED':
        await this.handleSubscriptionUpdated('STRIPE', event.data);
        break;
      case 'SUBSCRIPTION.CANCELED':
        await this.handleSubscriptionDeleted('STRIPE', event.data);
        break;
      default:
        this.logger.log(`Unhandled event: ${event.type}`);
    }
  }

  async handleFlutterwaveWebhook(payload: any, signature: string): Promise<void> {
    const adapter = this.gatewayFactory.getAdapter('FLUTTERWAVE');

    // Verify webhook
    const payloadString = JSON.stringify(payload);
    if (!adapter.verifyWebhook(signature, payloadString)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = payload.event;

    switch (event) {
      case 'charge.completed':
        await this.handlePaymentSucceeded('FLUTTERWAVE', payload.data);
        break;
      case 'charge.failed':
        await this.handlePaymentFailed('FLUTTERWAVE', payload.data);
        break;
      default:
        this.logger.log(`Unhandled Flutterwave event: ${event}`);
    }
  }

  async handlePaystackWebhook(payload: any, signature: string): Promise<void> {
    const adapter = this.gatewayFactory.getAdapter('PAYSTACK');

    // Verify webhook
    const payloadString = JSON.stringify(payload);
    if (!adapter.verifyWebhook(signature, payloadString)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = payload.event;

    switch (event) {
      case 'charge.success':
        await this.handlePaymentSucceeded('PAYSTACK', payload.data);
        break;
      case 'charge.failed':
        await this.handlePaymentFailed('PAYSTACK', payload.data);
        break;
      default:
        this.logger.log(`Unhandled Paystack event: ${event}`);
    }
  }

  async handleGenericWebhook(
    provider: string,
    payload: any,
    headers: Record<string, string>,
  ): Promise<void> {
    // Route to appropriate handler based on provider
    switch (provider.toUpperCase()) {
      case 'STRIPE':
        await this.handleStripeWebhook(payload, headers['stripe-signature'] || '');
        break;
      case 'FLUTTERWAVE':
        await this.handleFlutterwaveWebhook(payload, headers['verif-hash'] || '');
        break;
      case 'PAYSTACK':
        await this.handlePaystackWebhook(payload, headers['x-paystack-signature'] || '');
        break;
      default:
        throw new BadRequestException(`Unknown provider: ${provider}`);
    }
  }

  private async handlePaymentSucceeded(
    gateway: PaymentGateway,
    data: any,
  ): Promise<void> {
    this.logger.log(`Payment succeeded: ${gateway} - ${data.id || data.invoiceId}`);

    // Extract invoice ID from metadata or data
    // For Stripe: data.invoiceId or data.invoice (string ID)
    // For Flutterwave/Paystack: data.metadata?.invoiceId or data.reference
    const invoiceId = data.invoiceId || data.invoice || data.metadata?.invoiceId;
    const amountCents = data.amountCents || Math.round((data.amount || data.amount_paid || 0) * 100);

    if (invoiceId) {
      // Find invoice by gateway invoice ID or internal ID
      const invoice = await this.billingService.findInvoiceByGatewayId(
        invoiceId,
        gateway,
      );

      if (invoice) {
        await this.billingService.recordPayment(
          invoice.id,
          gateway,
          data.id || data.transaction_id || data.reference || data.charge,
          amountCents,
          { webhookData: data },
        );
      } else {
        this.logger.warn(`Invoice not found for gateway ID: ${invoiceId}`);
      }

      // Publish event
      await this.eventPublisher.publish(EventType.USER_CREATED, {
        gateway,
        invoiceId,
        paymentId: data.id,
        amount: amountCents,
      });
    }
  }

  private async handlePaymentFailed(
    gateway: PaymentGateway,
    data: any,
  ): Promise<void> {
    this.logger.log(`Payment failed: ${gateway} - ${data.id}`);

    // Publish event for failed payment
    await this.eventPublisher.publish('INVOICE.FAILED', {
      gateway,
      invoiceId: data.invoice,
      paymentId: data.id,
      reason: data.failure_reason || data.message,
    });
  }

  private async handleSubscriptionUpdated(
    gateway: PaymentGateway,
    data: any,
  ): Promise<void> {
    this.logger.log(`Subscription updated: ${gateway} - ${data.id}`);
    // Handle subscription updates
  }

  private async handleSubscriptionDeleted(
    gateway: PaymentGateway,
    data: any,
  ): Promise<void> {
    this.logger.log(`Subscription deleted: ${gateway} - ${data.id}`);
    // Handle subscription cancellation
  }
}

