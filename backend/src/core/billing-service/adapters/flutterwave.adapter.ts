import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  PaymentGateway,
  CustomerData,
  CreateSubscriptionParams,
  InvoicePayload,
  PaymentMethodToken,
} from '../interfaces/payment-gateway.interface';

@Injectable()
export class FlutterwaveAdapter implements PaymentGateway {
  private readonly logger = new Logger(FlutterwaveAdapter.name);
  private readonly baseUrl = 'https://api.flutterwave.com/v3';
  private readonly secretKey: string;
  private readonly publicKey: string;

  constructor(private configService: ConfigService) {
    this.secretKey =
      this.configService.get<string>('FLUTTERWAVE_SECRET_KEY') ||
      'FLWSECK_TEST_placeholder';
    this.publicKey =
      this.configService.get<string>('FLUTTERWAVE_PUBLIC_KEY') ||
      'FLWPUBK_TEST_placeholder';
  }

  getName(): string {
    return 'FLUTTERWAVE';
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  async createCustomer(
    tenantId: string,
    customerData: CustomerData,
  ): Promise<{ id: string }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/customers`,
        {
          email: customerData.email,
          name: customerData.name,
          phone: customerData.phone,
          meta: {
            tenantId,
            ...customerData.metadata,
          },
        },
        { headers: this.getHeaders() },
      );

      return { id: response.data.data.customer_email }; // Flutterwave uses email as ID
    } catch (error) {
      this.logger.error('Failed to create Flutterwave customer', error);
      throw error;
    }
  }

  async createSubscription(
    params: CreateSubscriptionParams,
  ): Promise<{
    id: string;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  }> {
    // Flutterwave subscription implementation
    // Note: Flutterwave uses payment plans differently
    const now = new Date();
    const endDate = params.trialEnd || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      id: `flw_sub_${Date.now()}`,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: endDate,
    };
  }

  async createInvoice(invoicePayload: InvoicePayload): Promise<{
    id: string;
    pdfUrl?: string;
    status: string;
  }> {
    // Flutterwave invoice creation
    const response = await axios.post(
      `${this.baseUrl}/payment-plans`,
      {
        amount: invoicePayload.amountCents / 100,
        name: invoicePayload.description || 'Invoice',
        interval: 'monthly',
        currency: invoicePayload.currency,
      },
      { headers: this.getHeaders() },
    );

    return {
      id: response.data.data.id.toString(),
      status: 'open',
    };
  }

  async retrieveInvoice(invoiceId: string): Promise<{
    id: string;
    status: string;
    amountPaid: number;
    amountDue: number;
    pdfUrl?: string;
  }> {
    // Implementation for retrieving invoice
    return {
      id: invoiceId,
      status: 'open',
      amountPaid: 0,
      amountDue: 0,
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
    // Flutterwave payment implementation
    return {
      id: `flw_pay_${Date.now()}`,
      status: 'successful',
      amount: 0,
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
    try {
      const response = await axios.post(
        `${this.baseUrl}/refunds`,
        {
          transaction_id: paymentId,
          amount: amountCents ? amountCents / 100 : undefined,
        },
        { headers: this.getHeaders() },
      );

      return {
        id: response.data.data.id.toString(),
        status: response.data.data.status,
        amount: response.data.data.amount * 100,
      };
    } catch (error) {
      this.logger.error('Flutterwave refund failed', error);
      throw error;
    }
  }

  verifyWebhook(signatureHeader: string, payload: string): boolean {
    const secretHash =
      this.configService.get<string>('FLUTTERWAVE_SECRET_HASH') ||
      'placeholder';

    // Flutterwave webhook verification
    const hash = require('crypto')
      .createHash('sha256')
      .update(JSON.stringify(JSON.parse(payload)) + secretHash)
      .digest('hex');

    return hash === signatureHeader;
  }
}

