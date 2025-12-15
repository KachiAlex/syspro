# Proration Calculation Examples

This document provides detailed numeric examples of proration calculations used in the billing system.

## Rounding Policy

**Policy**: Round prorated results to nearest cent using half-up rounding.

- 6,666.666... → 6,667 cents
- 6,666.333... → 6,666 cents
- 6,666.500... → 6,667 cents

## Example A: Monthly Subscription Upgrade (Mid-Cycle Proration)

### Scenario
- **Current Plan**: Starter at $100.00/month (10,000 cents)
- **New Plan**: Pro at $300.00/month (30,000 cents)
- **Billing Cycle**: Monthly
- **Period**: June 1 - June 30 (30 days)
- **Upgrade Date**: June 11
- **Days Used**: 10 days (June 1-10)
- **Days Remaining**: 20 days (June 11-30)

### Step-by-Step Calculation

#### Step 1: Convert to Cents
```
Starter price = $100.00 = 100.00 × 100 = 10,000 cents
Pro price = $300.00 = 300.00 × 100 = 30,000 cents
```

#### Step 2: Determine Days
```
Month length = 30 days
Days used on Starter = 10 days
Days remaining = 30 - 10 = 20 days
```

#### Step 3: Calculate Daily Rates
```
Starter daily = 10,000 cents ÷ 30 days = 333.333... cents/day
Pro daily = 30,000 cents ÷ 30 days = 1,000 cents/day
```

#### Step 4: Credit for Unused Starter Days
```
Unused Starter days = 20 days
Unused credit = (10,000 / 30) × 20 = 6,666.666... cents
Rounded (half-up) = 6,667 cents = $66.67
```

#### Step 5: Charge for Pro Remaining Days
```
Pro daily × remaining days = 1,000 × 20 = 20,000 cents = $200.00
```

#### Step 6: Net Prorated Amount
```
Charge new plan (20,000) - Credit old plan (6,667) = 13,333 cents
13,333 cents = $133.33
```

### Result
Tenant is invoiced **$133.33** immediately as prorated amount. The new billing period continues until June 30, and the next full-cycle charge for Pro ($300) occurs on July 1.

---

## Example B: Monthly Subscription Downgrade (Credit Applied)

### Scenario
- **Current Plan**: Pro at $300.00/month (30,000 cents)
- **New Plan**: Starter at $100.00/month (10,000 cents)
- **Billing Cycle**: Monthly
- **Period**: June 1 - June 30 (30 days)
- **Downgrade Date**: June 16
- **Days Used**: 15 days (June 1-15)
- **Days Remaining**: 15 days (June 16-30)

### Step-by-Step Calculation

#### Step 1: Convert to Cents
```
Pro = 30,000 cents
Starter = 10,000 cents
```

#### Step 2: Determine Days
```
Days used = 15 days
Days remaining = 30 - 15 = 15 days
```

#### Step 3: Calculate Daily Rates
```
Pro daily = 30,000 ÷ 30 = 1,000 cents/day
Starter daily = 10,000 ÷ 30 = 333.333... cents/day
```

#### Step 4: Credit for Unused Pro Days
```
Unused Pro days = 15 days
Credit = 1,000 × 15 = 15,000 cents = $150.00
```

#### Step 5: Charge for Starter Remaining Period
```
Starter daily = 10,000 ÷ 30 = 333.333... cents/day
Starter charge for 15 days = (10,000 ÷ 30) × 15 = 5,000 cents = $50.00
```

#### Step 6: Net Credit to Apply
```
Credit (15,000) - Starter charge (5,000) = 10,000 cents
10,000 cents = $100.00
```

### Result
Tenant receives a **$100.00 credit** applied to the next invoice (or refunded per policy).

---

## Example C: Metered Usage Billing (SMS)

### Scenario
- **Price per SMS**: $0.01 (1 cent)
- **Billing Period**: Monthly
- **Usage**: 18,732 SMS in period

### Step-by-Step Calculation

#### Step 1: Price per Unit
```
Price per SMS = $0.01 = 1 cent
```

#### Step 2: Multiply
```
18,732 SMS × 1 cent = 18,732 cents
```

#### Step 3: Convert to USD
```
18,732 cents ÷ 100 = $187.32
```

### Result
Invoice line item: **SMS usage (18,732 messages) - $187.32**

---

## Sample Invoice Structure (JSON)

```json
{
  "invoiceNumber": "INV-2025-0007",
  "tenantId": "tenant_123",
  "issuedAt": "2025-06-11T10:00:00Z",
  "dueAt": "2025-06-25T23:59:59Z",
  "currency": "USD",
  "lineItems": [
    {
      "description": "Prorated upgrade to Pro (Jun 11 - Jun 30)",
      "quantity": 1,
      "unitPriceCents": 13333,
      "totalCents": 13333
    },
    {
      "description": "SMS usage (Jun 1 - Jun 30) - 18,732 messages",
      "quantity": 18732,
      "unitPriceCents": 1,
      "totalCents": 18732
    }
  ],
  "subTotalCents": 32065,
  "taxCents": 0,
  "discountCents": 0,
  "totalDueCents": 32065,
  "amountPaidCents": 0,
  "status": "open"
}
```

**Total**: 32,065 cents = **$320.65**

---

## Credit Application Policy

**Default Policy**: Credits from downgrades are applied to the next invoice automatically.

**Refund Policy**: Credits can be refunded upon explicit request from tenant or admin.

---

## Test Cases

### Test Case 1: Upgrade Proration
- **Input**: Start=June1, upgrade=June11, starter=10000, pro=30000, monthDays=30
- **Expected**: proratedChargeCents = 13333

### Test Case 2: Downgrade Proration
- **Input**: Downgrade June16, pro=30000, starter=10000, monthDays=30
- **Expected**: netCredit = 10000 cents

### Test Case 3: Metering Aggregation
- **Input**: Meter events [1000, 5000, 12000, 732]
- **Expected**: total = 18732; invoice cents = 18732

### Test Case 4: Partial Cents Rounding
- **Input**: $7/month over 31-day month
- **Expected**: Consistent rounding (half-up) for all calculations

---

## Implementation Notes

1. All monetary calculations are performed in **cents** to avoid floating-point errors
2. Daily rates are calculated using exact fractions: `priceCents / totalDays`
3. Final proration amounts are rounded using half-up policy
4. Credits are stored as positive values; negative proration amounts indicate credits
5. Proration calculations are logged for audit purposes

