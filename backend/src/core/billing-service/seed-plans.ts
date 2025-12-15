// Seed script for default plans
// Run this to create initial subscription plans

import { DataSource } from 'typeorm';
import { Plan, BillingCycle } from './entities/plan.entity';

export async function seedPlans(dataSource: DataSource) {
  const planRepository = dataSource.getRepository(Plan);

  const plans = [
    {
      slug: 'free',
      name: 'Free Plan',
      description: 'Basic features for small teams',
      billingCycle: BillingCycle.MONTHLY,
      priceCents: 0,
      currency: 'USD',
      features: {
        users: 5,
        storage: '1GB',
        modules: ['BASIC'],
      },
      isActive: true,
      isSystemPlan: true,
    },
    {
      slug: 'starter',
      name: 'Starter Plan',
      description: 'Perfect for growing businesses',
      billingCycle: BillingCycle.MONTHLY,
      priceCents: 2900, // $29.00
      currency: 'USD',
      features: {
        users: 25,
        storage: '10GB',
        modules: ['HR', 'FINANCE', 'BASIC'],
      },
      isActive: true,
      isSystemPlan: true,
    },
    {
      slug: 'pro',
      name: 'Professional Plan',
      description: 'Advanced features for established companies',
      billingCycle: BillingCycle.MONTHLY,
      priceCents: 9900, // $99.00
      currency: 'USD',
      features: {
        users: 100,
        storage: '100GB',
        modules: ['*'], // All modules
      },
      isActive: true,
      isSystemPlan: true,
    },
    {
      slug: 'enterprise',
      name: 'Enterprise Plan',
      description: 'Custom solutions for large organizations',
      billingCycle: BillingCycle.YEARLY,
      priceCents: 99900, // $999.00/year
      currency: 'USD',
      features: {
        users: -1, // Unlimited
        storage: '1TB',
        modules: ['*'], // All modules
        support: 'priority',
        customIntegration: true,
      },
      isActive: true,
      isSystemPlan: true,
    },
  ];

  for (const planData of plans) {
    const existing = await planRepository.findOne({
      where: { slug: planData.slug },
    });

    if (!existing) {
      const plan = planRepository.create(planData);
      await planRepository.save(plan);
      console.log(`Created plan: ${planData.name}`);
    } else {
      console.log(`Plan already exists: ${planData.name}`);
    }
  }
}

