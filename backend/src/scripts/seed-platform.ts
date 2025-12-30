// Comprehensive seed script to initialize the multi-tenant platform
// Creates: Super Admin user, default plans, and sample tenant

import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import { Tenant } from '../entities/tenant.entity';
import { Organization } from '../entities/organization.entity';
import { UserTenantAccess } from '../entities/user-tenant-access.entity';
import { Plan, BillingCycle } from '../core/billing-service/entities/plan.entity';
import {
  Subscription,
  SubscriptionStatus,
} from '../core/billing-service/entities/subscription.entity';
import { getDatabaseConfig } from '../config/database.config';

async function seedPlatform(dataSource: DataSource) {
  console.log('🌱 Starting platform seed...\n');

  // 1. Create Subscription Plans
  console.log('📦 Creating subscription plans...');
  const planRepository = dataSource.getRepository(Plan);

  const plansData = [
    {
      slug: 'free',
      name: 'Free Plan',
      description: 'Basic features for small teams - Up to 5 users',
      billingCycle: BillingCycle.MONTHLY,
      priceCents: 0,
      currency: 'USD',
      features: {
        users: 5,
        storage: '1GB',
        modules: ['BASIC'],
        apiCalls: 1000,
      },
      isActive: true,
      isSystemPlan: true,
    },
    {
      slug: 'starter',
      name: 'Starter Plan',
      description: 'Perfect for growing businesses - Up to 25 users',
      billingCycle: BillingCycle.MONTHLY,
      priceCents: 2900, // $29.00
      currency: 'USD',
      features: {
        users: 25,
        storage: '10GB',
        modules: ['HR', 'FINANCE', 'BASIC'],
        apiCalls: 10000,
        support: 'email',
      },
      isActive: true,
      isSystemPlan: true,
    },
    {
      slug: 'professional',
      name: 'Professional Plan',
      description: 'Advanced features for established companies - Up to 100 users',
      billingCycle: BillingCycle.MONTHLY,
      priceCents: 9900, // $99.00
      currency: 'USD',
      features: {
        users: 100,
        storage: '100GB',
        modules: ['HR', 'FINANCE', 'INVENTORY', 'SALES', 'PROCUREMENT', 'BASIC'],
        apiCalls: 100000,
        support: 'priority',
        customReports: true,
      },
      isActive: true,
      isSystemPlan: true,
    },
    {
      slug: 'enterprise',
      name: 'Enterprise Plan',
      description: 'Custom solutions for large organizations - Unlimited users',
      billingCycle: BillingCycle.YEARLY,
      priceCents: 99900, // $999.00/year
      currency: 'USD',
      features: {
        users: -1, // Unlimited
        storage: '1TB',
        modules: ['*'], // All modules
        apiCalls: -1, // Unlimited
        support: 'priority_24/7',
        customIntegration: true,
        dedicatedAccountManager: true,
        sla: '99.9%',
      },
      isActive: true,
      isSystemPlan: true,
    },
  ];

  const createdPlans: Plan[] = [];
  for (const planData of plansData) {
    let plan = await planRepository.findOne({ where: { slug: planData.slug } });
    
    if (!plan) {
      plan = planRepository.create(planData);
      await planRepository.save(plan);
      console.log(`  ✓ Created plan: ${planData.name} ($${planData.priceCents / 100})`);
    } else {
      console.log(`  ⊙ Plan already exists: ${planData.name}`);
    }
    createdPlans.push(plan);
  }

  // 2. Create Platform Tenant
  console.log('\n🏗️  Creating platform tenant...');
  const tenantRepository = dataSource.getRepository(Tenant);

  let platformTenant = await tenantRepository.findOne({
    where: { code: 'PLATFORM' },
  });

  if (!platformTenant) {
    platformTenant = tenantRepository.create({
      name: 'Platform Tenant',
      code: 'PLATFORM',
      isActive: true,
    });
    platformTenant = await tenantRepository.save(platformTenant);
    console.log('  ✓ Created platform tenant');
  } else {
    console.log('  ⊙ Platform tenant already exists');
  }

  // 3. Create Super Admin Organization (attached to platform tenant)
  console.log('\n🏢 Creating platform organization...');
  const orgRepository = dataSource.getRepository(Organization);

  let platformOrg = await orgRepository.findOne({
    where: { tenantId: platformTenant.id },
  });

  if (!platformOrg) {
    platformOrg = orgRepository.create({
      name: 'Syspro Platform',
      domain: 'syspro-platform.com',
      tenantId: platformTenant.id,
      settings: {
        timezone: 'UTC',
        currency: 'USD',
        dateFormat: 'YYYY-MM-DD',
      },
      isActive: true,
    });
    platformOrg = await orgRepository.save(platformOrg);
    console.log('  ✓ Created platform organization');
  } else {
    console.log('  ⊙ Platform organization already exists');
  }

  // 4. Create Super Admin User
  console.log('\n👤 Creating super admin user...');
  const userRepository = dataSource.getRepository(User);
  
  const adminEmail = process.env.SUPERADMIN_EMAIL || 'admin@syspro.com';
  const adminPassword = process.env.SUPERADMIN_PASSWORD || 'Admin@123';
  let adminUser = await userRepository.findOne({ where: { email: adminEmail } });
  
  if (!adminUser) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    adminUser = userRepository.create({
      firstName: 'Super',
      lastName: 'Admin',
      email: adminEmail,
      password: hashedPassword,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      organizationId: platformOrg.id,
      tenantId: platformTenant.id,
    });
    await userRepository.save(adminUser);
    console.log('  ✓ Created super admin user');
    console.log(`     Email: ${adminEmail}`);
    console.log(`     Password: ${adminPassword}`);
    console.log('     ⚠️  PLEASE CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!');
  } else {
    console.log('  ⊙ Super admin user already exists');
    console.log(`     Email: ${adminEmail}`);
  }

  // 5. Grant Admin Access to Platform Tenant
  console.log('\n🔑 Setting up admin access...');
  const accessRepository = dataSource.getRepository(UserTenantAccess);
  
  let adminAccess = await accessRepository.findOne({
    where: { 
      userId: adminUser.id, 
      tenantId: platformTenant.id 
    }
  });
  
  if (!adminAccess) {
    adminAccess = accessRepository.create({
      userId: adminUser.id,
      tenantId: platformTenant.id,
    });
    await accessRepository.save(adminAccess);
    console.log('  ✓ Granted super admin access to platform tenant');
  } else {
    console.log('  ⊙ Admin access already configured');
  }

  // 6. Subscribe Platform Tenant to Enterprise Plan
  console.log('\n💳 Setting up platform subscription...');
  const subscriptionRepository = dataSource.getRepository(Subscription);
  
  const enterprisePlan = createdPlans.find(p => p.slug === 'enterprise');
  
  let platformSubscription = await subscriptionRepository.findOne({
    where: { 
      tenantId: platformTenant.id,
      status: SubscriptionStatus.ACTIVE,
    }
  });
  
  if (!platformSubscription && enterprisePlan) {
    const now = new Date();
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    
    platformSubscription = subscriptionRepository.create({
      tenantId: platformTenant.id,
      planId: enterprisePlan.id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: nextYear,
      cancelAtPeriodEnd: false,
      metadata: {
        type: 'platform',
        complimentary: true,
      },
    });
    await subscriptionRepository.save(platformSubscription);
    console.log('  ✓ Created enterprise subscription for platform');
  } else {
    console.log('  ⊙ Platform subscription already exists');
  }

  // 7. Create Sample Demo Tenant + Organization
  console.log('\n🎯 Creating demo tenant...');
  
  let demoTenant = await tenantRepository.findOne({ where: { code: 'DEMO' } });
  if (!demoTenant) {
    demoTenant = tenantRepository.create({
      name: 'Demo Company Tenant',
      code: 'DEMO',
      isActive: true,
    });
    demoTenant = await tenantRepository.save(demoTenant);
    console.log('  ✓ Created demo tenant');
  } else {
    console.log('  ⊙ Demo tenant already exists');
  }

  let demoOrg = await orgRepository.findOne({
    where: { tenantId: demoTenant.id },
  });
  if (!demoOrg) {
    demoOrg = orgRepository.create({
      name: 'Demo Company',
      domain: 'demo-company.com',
      tenantId: demoTenant.id,
      settings: {
        timezone: 'America/New_York',
        currency: 'USD',
        dateFormat: 'MM/DD/YYYY',
      },
      isActive: true,
    });
    await orgRepository.save(demoOrg);
    console.log('  ✓ Created demo organization');
  } else {
    console.log('  ⊙ Demo organization already exists');
  }

  const starterPlan = createdPlans.find((p) => p.slug === 'starter');
  if (!starterPlan) {
    console.warn('⚠️ Starter plan missing, skipping demo subscription creation');
  } else {
    const existingDemoSubscription = await subscriptionRepository.findOne({
      where: {
        tenantId: demoTenant.id,
        planId: starterPlan.id,
      },
    });

    if (!existingDemoSubscription) {
      const now = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const demoSubscription = subscriptionRepository.create({
        tenantId: demoTenant.id,
        planId: starterPlan.id,
        status: SubscriptionStatus.TRIALING,
        currentPeriodStart: now,
        currentPeriodEnd: nextMonth,
        cancelAtPeriodEnd: false,
        metadata: {
          type: 'trial',
          trialDays: 30,
        },
      });
      await subscriptionRepository.save(demoSubscription);
      console.log('  ✓ Created trial subscription for demo tenant');
    } else {
      console.log('  ⊙ Demo tenant already has starter subscription');
    }
  }

  console.log('\n✅ Platform seed completed successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 SUMMARY:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('🔐 SUPER ADMIN CREDENTIALS:');
  console.log('   Email: admin@syspro.com');
  console.log('   Password: Admin@123');
  console.log('   Role: SUPER_ADMIN');
  console.log('');
  console.log('🏢 ORGANIZATIONS CREATED:');
  console.log('   1. Syspro Platform (PLATFORM)');
  console.log('   2. Demo Company (DEMO)');
  console.log('');
  console.log('📦 SUBSCRIPTION PLANS:');
  console.log('   1. Free - $0/month');
  console.log('   2. Starter - $29/month');
  console.log('   3. Professional - $99/month');
  console.log('   4. Enterprise - $999/year');
  console.log('');
  console.log('🎯 NEXT STEPS:');
  console.log('   1. Login at: https://syspro-oct5ecv1n-onyedikachi-akomas-projects.vercel.app/login');
  console.log('   2. Change admin password immediately');
  console.log('   3. Access tenant management at: /api/tenants');
  console.log('   4. Access billing at: /api/billing/tenants');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Main execution
async function main() {
  const configService = new ConfigService();
  const dataSourceOptions = getDatabaseConfig(
    configService,
  ) as DataSourceOptions;

  if ('url' in dataSourceOptions && dataSourceOptions.url) {
    const sanitizedUrl = (dataSourceOptions.url as string).replace(
      /:[^:@]+@/,
      ':[REDACTED]@',
    );
    console.log('🗄️  Using DB URL:', sanitizedUrl);
  }
  const dataSource = new DataSource(dataSourceOptions);

  try {
    console.log('🚀 Connecting to database...');
    await dataSource.initialize();
    console.log('✓ Database connected\n');

    await seedPlatform(dataSource);

    await dataSource.destroy();
    console.log('👋 Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { seedPlatform };

