import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingController } from './controllers/billing.controller';
import { WebhookController } from './controllers/webhook.controller';
import { ReportingController } from './controllers/reporting.controller';
import { PlansController } from './controllers/plans.controller';
import { TenantsController } from './controllers/tenants.controller';
import { BillingService } from './services/billing.service';
import { SubscriptionService } from './services/subscription.service';
import { MeteringService } from './services/metering.service';
import { LicensingService } from './services/licensing.service';
import { WebhookService } from './services/webhook.service';
import { ReportingService } from './services/reporting.service';
import { InvoicePdfService } from './services/invoice-pdf.service';
import { ProrationService } from './services/proration.service';
import { PaymentGatewayFactory } from './factories/payment-gateway.factory';
import { IdempotencyService } from './utils/idempotency';
import { Event } from './entities/webhook-event.entity';
import { StripeAdapter } from './adapters/stripe.adapter';
import { StripeWebhookHandler } from './adapters/stripe/stripe.webhook';
import { FlutterwaveAdapter } from './adapters/flutterwave.adapter';
import { PaystackAdapter } from './adapters/paystack.adapter';
import { Plan } from './entities/plan.entity';
import { Subscription } from './entities/subscription.entity';
import { Invoice } from './entities/invoice.entity';
import { Payment } from './entities/payment.entity';
import { License } from './entities/license.entity';
import { MeterEvent } from './entities/meter-event.entity';
import { Tenant } from '../../entities/tenant.entity';
import { TenantModule } from '../../modules/tenant/tenant.module';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Plan,
      Subscription,
      Invoice,
      Payment,
      License,
      MeterEvent,
      Event,
      Tenant,
    ]),
    TenantModule,
    SharedModule,
  ],
  controllers: [
    BillingController,
    WebhookController,
    ReportingController,
    PlansController,
    TenantsController,
  ],
  providers: [
    BillingService,
    SubscriptionService,
    MeteringService,
    LicensingService,
    WebhookService,
    ReportingService,
    InvoicePdfService,
    ProrationService,
    IdempotencyService,
    PaymentGatewayFactory,
    StripeAdapter,
    StripeWebhookHandler,
    FlutterwaveAdapter,
    PaystackAdapter,
  ],
  exports: [
    BillingService,
    SubscriptionService,
    MeteringService,
    LicensingService,
    ReportingService,
  ],
})
export class BillingModule {}

