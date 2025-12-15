import { Injectable } from '@nestjs/common';
import { PaymentGateway } from '../interfaces/payment-gateway.interface';
import { StripeAdapter } from '../adapters/stripe.adapter';
import { FlutterwaveAdapter } from '../adapters/flutterwave.adapter';
import { PaystackAdapter } from '../adapters/paystack.adapter';

@Injectable()
export class PaymentGatewayFactory {
  private adapters: Map<string, PaymentGateway> = new Map();

  constructor(
    private stripeAdapter: StripeAdapter,
    private flutterwaveAdapter: FlutterwaveAdapter,
    private paystackAdapter: PaystackAdapter,
  ) {
    this.adapters.set('STRIPE', this.stripeAdapter);
    this.adapters.set('FLUTTERWAVE', this.flutterwaveAdapter);
    this.adapters.set('PAYSTACK', this.paystackAdapter);
  }

  getAdapter(gateway: string): PaymentGateway {
    const adapter = this.adapters.get(gateway.toUpperCase());

    if (!adapter) {
      throw new Error(`Payment gateway ${gateway} not supported`);
    }

    return adapter;
  }

  getAllAdapters(): PaymentGateway[] {
    return Array.from(this.adapters.values());
  }
}

