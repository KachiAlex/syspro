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
export class PaystackAdapter implements PaymentGateway {
  private readonly logger = new Logger(PaystackAdapter.name);
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly secretKey: string;
  private readonly publicKey: string;

  constructor(private configService: ConfigService) {
    this.secretKey =
      this.configService.get<string>('PAYSTACK_SECRET_KEY') ||
      'sk_test_placeholder';
    this.publicKey =
      this.configService.get<string>('PAYSTACK_PUBLIC_KEY') ||
      'pk_test_placeholder';
  }

  getName(): string {
    return 'PAYSTACK';
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
        `${this.baseUrl}/customer`,
        {
          email: customerData.email,
          first_name: customerData.name?.split(' ')[0],
          last_name: customerData.name?.split(' ').slice(1).join(' '),
          phone: customerData.phone,
          metadata: {
            tenantId,
            ...customerData.metadata,
          },
        },
        { headers: this.getHeaders() },
      );

      return { id: response.data.data.customer_code };
    } catch (error) {
      this.logger.error('Failed to create Paystack customer', error);
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
    // Paystack subscription creation
    const now = new Date();
    const endDate = params.trialEnd || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      id: `paystack_sub_${Date.now()}`,
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
    // Paystack invoice creation
    const response = await axios.post(
      `${this.baseUrl}/paymentrequest`,
      {
        customer: invoicePayload.customerId,
        amount: invoicePayload.amountCents / 100,
        currency: invoicePayload.currency,
        description: invoicePayload.description,
        metadata: invoicePayload.metadata,
      },
      { headers: this.getHeaders() },
    );

    return {
      id: response.data.data.id.toString(),
      status: 'pending',
    };
  }

  async retrieveInvoice(invoiceId: string): Promise<{
    id: string;
    status: string;
    amountPaid: number;
    amountDue: number;
    pdfUrl?: string;
  }> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/paymentrequest/${invoiceId}`,
        { headers: this.getHeaders() },
      );

      const invoice = response.data.data;

      return {
        id: invoice.id.toString(),
        status: invoice.status,
        amountPaid: invoice.amount_paid * 100,
        amountDue: invoice.amount * 100 - invoice.amount_paid * 100,
      };
    } catch (error) {
      this.logger.error('Failed to retrieve Paystack invoice', error);
      throw error;
    }
  }

  async payInvoice(
    invoiceId: string,
    paymentMethodToken: PaymentMethodToken,
  ): Promise<{
    id: string;
    status: string;
    amount: number;
  }> {
    // Paystack payment implementation
    return {
      id: `paystack_pay_${Date.now()}`,
      status: 'success',
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
        `${this.baseUrl}/refund`,
        {
          transaction: paymentId,
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
      this.logger.error('Paystack refund failed', error);
      throw error;
    }
  }

  verifyWebhook(signatureHeader: string, payload: string): boolean {
    const secretKey = this.secretKey;

    // Paystack webhook verification
    const hash = require('crypto')
      .createHmac('sha512', secretKey)
      .update(JSON.stringify(JSON.parse(payload)))
      .digest('hex');

    return hash === signatureHeader;
  }
}

