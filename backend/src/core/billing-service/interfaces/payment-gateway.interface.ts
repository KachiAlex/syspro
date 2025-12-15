export interface CustomerData {
  email: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, any>;
}

export interface CreateSubscriptionParams {
  customerId: string;
  planId: string;
  trialEnd?: Date;
  metadata?: Record<string, any>;
}

export interface InvoicePayload {
  customerId: string;
  amountCents: number;
  currency: string;
  description?: string;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
  }>;
  metadata?: Record<string, any>;
}

export interface PaymentMethodToken {
  token: string;
  type: 'card' | 'bank' | 'other';
}

export interface PaymentGateway {
  /**
   * Create a customer in the payment gateway
   */
  createCustomer(
    tenantId: string,
    customerData: CustomerData,
  ): Promise<{ id: string }>;

  /**
   * Create a subscription
   */
  createSubscription(
    params: CreateSubscriptionParams,
  ): Promise<{
    id: string;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  }>;

  /**
   * Create an invoice
   */
  createInvoice(invoicePayload: InvoicePayload): Promise<{
    id: string;
    pdfUrl?: string;
    status: string;
  }>;

  /**
   * Retrieve invoice details
   */
  retrieveInvoice(invoiceId: string): Promise<{
    id: string;
    status: string;
    amountPaid: number;
    amountDue: number;
    pdfUrl?: string;
  }>;

  /**
   * Pay an invoice
   */
  payInvoice(
    invoiceId: string,
    paymentMethodToken: PaymentMethodToken,
  ): Promise<{
    id: string;
    status: string;
    amount: number;
  }>;

  /**
   * Refund a payment
   */
  refundPayment(
    paymentId: string,
    amountCents?: number,
  ): Promise<{
    id: string;
    status: string;
    amount: number;
  }>;

  /**
   * Verify webhook signature
   */
  verifyWebhook(signatureHeader: string, payload: string): boolean;

  /**
   * Get gateway name
   */
  getName(): string;
}

