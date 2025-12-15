# Tenant Billing, Subscription & Licensing System (TBLS)

## Overview

Complete billing system for managing subscriptions, invoices, payments, metering, and module licensing.

## Components

### 1. Entities
- **Plan**: Subscription plans (free, starter, pro, enterprise)
- **Subscription**: Tenant subscriptions with status tracking
- **Invoice**: Generated invoices with PDF support
- **Payment**: Payment records from gateways
- **License**: Module-level licensing with quotas
- **MeterEvent**: Usage tracking for metered billing

### 2. Services

#### Subscription Service
- Create subscriptions with trial support
- Upgrade/downgrade with proration
- Cancel subscriptions
- Period management

#### Billing Service
- Invoice generation
- Payment recording
- Invoice PDF generation (S3 storage)
- Invoice status management

#### Metering Service
- Record usage events
- Aggregate usage by period
- Usage summaries by event type

#### Licensing Service
- Enable/disable modules per tenant
- Quota management
- License expiration handling

#### Reporting Service
- Revenue reports
- AR aging reports
- MRR/ARR calculations

### 3. Payment Gateways

#### Supported Gateways
- **Stripe** (Primary)
- **Flutterwave**
- **Paystack**

#### Adapter Pattern
All gateways implement `PaymentGateway` interface for easy swapping.

### 4. Webhooks

Centralized webhook handler at `/api/billing/webhooks/:provider`

**Supported Events**:
- `invoice.payment_succeeded` → INVOICE.PAID
- `invoice.payment_failed` → INVOICE.FAILED
- `customer.subscription.updated` → Subscription updates
- `customer.subscription.deleted` → Subscription cancellation

## API Endpoints

### Subscriptions
- `GET /api/billing/subscription` - Get current subscription
- `POST /api/billing/subscription` - Create subscription
- `POST /api/billing/subscription/:id/upgrade` - Upgrade subscription
- `POST /api/billing/subscription/:id/cancel` - Cancel subscription

### Invoices
- `GET /api/billing/invoices` - List invoices
- `GET /api/billing/invoices/:id` - Get invoice details
- Invoice PDFs available via `pdfUrl` field

### Metering
- `POST /api/billing/metering/events` - Record usage event
- `GET /api/billing/metering/usage` - Get current period usage

### Licensing
- `GET /api/billing/licenses` - Get all licenses
- `POST /api/billing/licenses/:moduleKey/enable` - Enable module
- `POST /api/billing/licenses/:moduleKey/disable` - Disable module

### Reports
- `GET /api/billing/reports/revenue` - Revenue report
- `GET /api/billing/reports/ar` - AR aging report
- `GET /api/billing/reports/mrr` - Monthly Recurring Revenue
- `GET /api/billing/reports/arr` - Annual Recurring Revenue

### Webhooks
- `POST /api/billing/webhooks/stripe` - Stripe webhooks
- `POST /api/billing/webhooks/flutterwave` - Flutterwave webhooks
- `POST /api/billing/webhooks/paystack` - Paystack webhooks

## Environment Variables

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Flutterwave
FLUTTERWAVE_SECRET_KEY=FLWSECK_...
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_...
FLUTTERWAVE_SECRET_HASH=...

# Paystack
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...

# Local Storage (for invoice PDFs)
INVOICE_STORAGE_PATH=./storage/invoices
```

## Usage Examples

### Create Subscription
```typescript
POST /api/billing/subscription
{
  "planId": "plan-uuid",
  "gateway": "STRIPE",
  "trialDays": 14
}
```

### Record Metering Event
```typescript
POST /api/billing/metering/events
{
  "eventType": "sms.sent",
  "value": 1,
  "meta": { "recipient": "+1234567890" }
}
```

### Enable Module License
```typescript
POST /api/billing/licenses/HR/enable
{
  "quota": 100,
  "expiresAt": "2025-12-31T00:00:00Z"
}
```

## Proration Logic

When upgrading/downgrading:
1. Calculate unused portion of current plan (credit)
2. Calculate remaining period cost of new plan (charge)
3. Net proration = charge - credit
4. Generate proration invoice if amount ≠ 0

## Invoice PDF Generation

- Uses Handlebars templates
- Rendered with Puppeteer
- Stored in local storage (configurable via INVOICE_STORAGE_PATH)
- URL returned in `pdfUrl` field

## Security

- Webhook signature verification for all providers
- Encrypted gateway charge IDs (in production)
- No raw card data storage
- PCI-compliant via gateway tokenization

## Next Steps

1. **Admin UI**: Build React components for billing management
2. **Email Notifications**: Send invoices via email
3. **Retry Logic**: Implement payment retry schedules
4. **Grace Periods**: Add configurable grace periods
5. **Coupons**: Implement discount codes
6. **Refunds**: Complete refund workflow

