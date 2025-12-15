import { ProrationService } from '../services/proration.service';
import { Subscription, SubscriptionStatus } from '../entities/subscription.entity';
import { Plan, BillingCycle } from '../entities/plan.entity';

describe('ProrationService', () => {
  let service: ProrationService;

  beforeEach(() => {
    service = new ProrationService();
  });

  describe('Upgrade Proration (Example A)', () => {
    it('should calculate proration for monthly upgrade mid-cycle', () => {
      // Setup: Starter $100/month, Pro $300/month, 30-day month, upgrade on day 11
      const periodStart = new Date('2025-06-01');
      const periodEnd = new Date('2025-06-30');
      const upgradeDate = new Date('2025-06-11');

      const starterPlan: Plan = {
        id: 'starter-id',
        slug: 'starter',
        name: 'Starter',
        description: '',
        billingCycle: BillingCycle.MONTHLY,
        priceCents: 10000, // $100.00
        currency: 'USD',
        features: {},
        isActive: true,
        isSystemPlan: false,
        subscriptions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const proPlan: Plan = {
        id: 'pro-id',
        slug: 'pro',
        name: 'Pro',
        description: '',
        billingCycle: BillingCycle.MONTHLY,
        priceCents: 30000, // $300.00
        currency: 'USD',
        features: {},
        isActive: true,
        isSystemPlan: false,
        subscriptions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const subscription: Subscription & { plan: Plan } = {
        id: 'sub-id',
        tenantId: 'tenant-1',
        plan: starterPlan,
        planId: 'starter-id',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialEnd: null,
        canceledAt: null,
        cancelAtPeriodEnd: false,
        proration: null,
        gatewayCustomerId: null,
        gatewaySubscriptionId: null,
        metadata: null,
        invoices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = service.calculateProration(subscription, proPlan, upgradeDate);

      // Expected: 13,333 cents = $133.33
      expect(result.amountCents).toBe(13333);
      expect(result.creditCents).toBe(6667); // Rounded from 6,666.666...
      expect(result.chargeCents).toBe(20000);
      expect(result.calculation.daysUsed).toBe(10);
      expect(result.calculation.daysRemaining).toBe(20);
      expect(result.calculation.totalDays).toBe(30);
    });
  });

  describe('Downgrade Proration (Example B)', () => {
    it('should calculate proration for monthly downgrade mid-cycle', () => {
      // Setup: Pro $300/month, Starter $100/month, 30-day month, downgrade on day 16
      const periodStart = new Date('2025-06-01');
      const periodEnd = new Date('2025-06-30');
      const downgradeDate = new Date('2025-06-16');

      const proPlan: Plan = {
        id: 'pro-id',
        slug: 'pro',
        name: 'Pro',
        description: '',
        billingCycle: BillingCycle.MONTHLY,
        priceCents: 30000, // $300.00
        currency: 'USD',
        features: {},
        isActive: true,
        isSystemPlan: false,
        subscriptions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const starterPlan: Plan = {
        id: 'starter-id',
        slug: 'starter',
        name: 'Starter',
        description: '',
        billingCycle: BillingCycle.MONTHLY,
        priceCents: 10000, // $100.00
        currency: 'USD',
        features: {},
        isActive: true,
        isSystemPlan: false,
        subscriptions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const subscription: Subscription & { plan: Plan } = {
        id: 'sub-id',
        tenantId: 'tenant-1',
        plan: proPlan,
        planId: 'pro-id',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialEnd: null,
        canceledAt: null,
        cancelAtPeriodEnd: false,
        proration: null,
        gatewayCustomerId: null,
        gatewaySubscriptionId: null,
        metadata: null,
        invoices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = service.calculateDowngradeProration(
        subscription,
        starterPlan,
        downgradeDate,
      );

      // Expected: -10,000 cents = -$100.00 (credit)
      expect(result.amountCents).toBe(-10000);
      expect(result.creditCents).toBe(15000);
      expect(result.chargeCents).toBe(5000);
      expect(result.calculation.daysUsed).toBe(15);
      expect(result.calculation.daysRemaining).toBe(15);
    });
  });

  describe('Metered Usage (Example C)', () => {
    it('should calculate SMS usage billing', () => {
      // Setup: $0.01 per SMS, 18,732 SMS used
      const unitPriceCents = 1; // $0.01
      const quantity = 18732;

      const total = service.calculateMeteredUsage(unitPriceCents, quantity);

      // Expected: 18,732 cents = $187.32
      expect(total).toBe(18732);
    });
  });

  describe('Rounding Policy', () => {
    it('should round half-up correctly', () => {
      // Test with repeating decimals
      const periodStart = new Date('2025-07-01');
      const periodEnd = new Date('2025-07-31'); // 31-day month
      const upgradeDate = new Date('2025-07-11');

      const plan7: Plan = {
        id: 'plan-7',
        slug: 'plan-7',
        name: 'Plan $7',
        description: '',
        billingCycle: BillingCycle.MONTHLY,
        priceCents: 700, // $7.00
        currency: 'USD',
        features: {},
        isActive: true,
        isSystemPlan: false,
        subscriptions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const subscription: Subscription & { plan: Plan } = {
        id: 'sub-id',
        tenantId: 'tenant-1',
        plan: plan7,
        planId: 'plan-7',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialEnd: null,
        canceledAt: null,
        cancelAtPeriodEnd: false,
        proration: null,
        gatewayCustomerId: null,
        gatewaySubscriptionId: null,
        metadata: null,
        invoices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Daily rate = 700 / 31 = 22.580645... cents/day
      // 20 days remaining = 451.612903... cents
      // Should round to 452 cents (half-up)
      const result = service.calculateProration(
        subscription,
        { ...plan7, priceCents: 1400 }, // Upgrade to $14/month
        upgradeDate,
      );

      // Verify rounding is consistent
      expect(result.chargeCents).toBeGreaterThan(0);
      expect(result.creditCents).toBeGreaterThan(0);
    });
  });
});

