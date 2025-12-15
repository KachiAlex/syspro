import { Injectable } from '@nestjs/common';
import { Subscription } from '../entities/subscription.entity';
import { Plan } from '../entities/plan.entity';

export interface ProrationResult {
  amountCents: number;
  creditCents: number;
  chargeCents: number;
  description: string;
  calculation: {
    daysUsed: number;
    daysRemaining: number;
    totalDays: number;
    oldPlanDailyRate: number;
    newPlanDailyRate: number;
  };
}

@Injectable()
export class ProrationService {
  /**
   * Calculate proration for subscription upgrade/downgrade
   * 
   * Example A: Monthly upgrade mid-cycle
   * - Starter: $100/month (10,000 cents)
   * - Pro: $300/month (30,000 cents)
   * - Month: 30 days
   * - Upgrade on day 11 (10 days used, 20 days remaining)
   * 
   * Calculation:
   * 1. Starter daily = 10,000 / 30 = 333.333... cents/day
   * 2. Pro daily = 30,000 / 30 = 1,000 cents/day
   * 3. Credit unused Starter = 333.333... × 20 = 6,666.666... → 6,667 cents (round half-up)
   * 4. Charge Pro remaining = 1,000 × 20 = 20,000 cents
   * 5. Net proration = 20,000 - 6,667 = 13,333 cents = $133.33
   */
  calculateProration(
    currentSubscription: Subscription & { plan: Plan },
    newPlan: Plan,
    upgradeDate: Date,
  ): ProrationResult {
    const periodStart = currentSubscription.currentPeriodStart;
    const periodEnd = currentSubscription.currentPeriodEnd;

    // Calculate days
    const totalDays = Math.ceil(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
    );

    const daysUsed = Math.ceil(
      (upgradeDate.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
    );

    const daysRemaining = totalDays - daysUsed;

    // Daily rates (in cents)
    const oldPlanDailyRate = currentSubscription.plan.priceCents / totalDays;
    const newPlanDailyRate = newPlan.priceCents / totalDays;

    // Credit for unused portion of old plan
    // Using exact fraction to avoid floating point errors
    const unusedCreditExact = (currentSubscription.plan.priceCents * daysRemaining) / totalDays;
    const creditCents = this.roundHalfUp(unusedCreditExact);

    // Charge for remaining period of new plan
    const chargeExact = (newPlan.priceCents * daysRemaining) / totalDays;
    const chargeCents = this.roundHalfUp(chargeExact);

    // Net proration amount
    const amountCents = chargeCents - creditCents;

    return {
      amountCents,
      creditCents,
      chargeCents,
      description: `Proration for upgrade from ${currentSubscription.plan.name} to ${newPlan.name} (${daysRemaining} days remaining)`,
      calculation: {
        daysUsed,
        daysRemaining,
        totalDays,
        oldPlanDailyRate: Math.round(oldPlanDailyRate * 100) / 100, // Round for display
        newPlanDailyRate: Math.round(newPlanDailyRate * 100) / 100,
      },
    };
  }

  /**
   * Calculate proration for downgrade
   * 
   * Example B: Monthly downgrade mid-cycle
   * - Pro: $300/month (30,000 cents)
   * - Starter: $100/month (10,000 cents)
   * - Month: 30 days
   * - Downgrade on day 16 (15 days used, 15 days remaining)
   * 
   * Calculation:
   * 1. Pro daily = 30,000 / 30 = 1,000 cents/day
   * 2. Starter daily = 10,000 / 30 = 333.333... cents/day
   * 3. Credit unused Pro = 1,000 × 15 = 15,000 cents
   * 4. Charge Starter remaining = 333.333... × 15 = 5,000 cents
   * 5. Net credit = 15,000 - 5,000 = 10,000 cents = $100.00
   */
  calculateDowngradeProration(
    currentSubscription: Subscription & { plan: Plan },
    newPlan: Plan,
    downgradeDate: Date,
  ): ProrationResult {
    const periodStart = currentSubscription.currentPeriodStart;
    const periodEnd = currentSubscription.currentPeriodEnd;

    const totalDays = Math.ceil(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
    );

    const daysUsed = Math.ceil(
      (downgradeDate.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
    );

    const daysRemaining = totalDays - daysUsed;

    const oldPlanDailyRate = currentSubscription.plan.priceCents / totalDays;
    const newPlanDailyRate = newPlan.priceCents / totalDays;

    // Credit for unused old plan
    const creditExact = (currentSubscription.plan.priceCents * daysRemaining) / totalDays;
    const creditCents = this.roundHalfUp(creditExact);

    // Charge for new plan remaining period
    const chargeExact = (newPlan.priceCents * daysRemaining) / totalDays;
    const chargeCents = this.roundHalfUp(chargeExact);

    // Net credit (negative amount means credit)
    const amountCents = chargeCents - creditCents; // Will be negative for downgrade

    return {
      amountCents,
      creditCents,
      chargeCents,
      description: `Proration for downgrade from ${currentSubscription.plan.name} to ${newPlan.name} (${daysRemaining} days remaining)`,
      calculation: {
        daysUsed,
        daysRemaining,
        totalDays,
        oldPlanDailyRate: Math.round(oldPlanDailyRate * 100) / 100,
        newPlanDailyRate: Math.round(newPlanDailyRate * 100) / 100,
      },
    };
  }

  /**
   * Calculate metered usage billing
   * 
   * Example C: SMS usage billing
   * - Price per SMS: $0.01 (1 cent)
   * - Usage: 18,732 SMS
   * 
   * Calculation:
   * 1. Price per unit = 1 cent
   * 2. Total = 18,732 × 1 = 18,732 cents
   * 3. Convert to USD = 18,732 / 100 = $187.32
   */
  calculateMeteredUsage(
    unitPriceCents: number,
    quantity: number,
  ): number {
    return unitPriceCents * quantity;
  }

  /**
   * Round to nearest cent using half-up rounding
   * 6,666.666... → 6,667
   * 6,666.333... → 6,666
   */
  private roundHalfUp(value: number): number {
    return Math.round(value);
  }
}

