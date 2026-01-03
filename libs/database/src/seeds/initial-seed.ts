import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Tenant, Organization, User, UserRole, Permission, Subscription } from '../index';

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELED = 'canceled',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
  TRIALING = 'trialing'
}

export async function runInitialSeed(dataSource: DataSource): Promise<void> {
  console.log('🌱 Running initial database seed...');

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // 1. Create Platform Tenant
    const tenantRepository = queryRunner.manager.getRepository(Tenant);
    let platformTenant = await tenantRepository.findOne({
      where: { code: 'PLATFORM' },
    });

    if (!platformTenant) {
      platformTenant = tenantRepository.create({
        name: 'Syspro Platform',
        code: 'PLATFORM',
        domain: 'platform.syspro.com',
        isActive: true,
        settings: {
          timezone: 'UTC',
          currency: 'USD',
          dateFormat: 'YYYY-MM-DD',
          language: 'en',
          features: ['crm', 'inventory', 'finance', 'hr', 'projects', 'reports'],
          branding: {
            primaryColor: '#667eea',
            secondaryColor: '#764ba2',
          },
        },
      });
      platformTenant = await tenantRepository.save(platformTenant);
      console.log('✅ Created platform tenant');
    }

    // 2. Create Platform Organization
    const organizationRepository = queryRunner.manager.getRepository(Organization);
    let platformOrg = await organizationRepository.findOne({
      where: { tenantId: platformTenant.id, name: 'Syspro Platform' },
    });

    if (!platformOrg) {
      platformOrg = organizationRepository.create({
        name: 'Syspro Platform',
        description: 'Main platform organization for Syspro ERP',
        code: 'PLATFORM_ORG',
        isActive: true,
        tenantId: platformTenant.id,
        settings: {
          allowSubOrganizations: true,
          maxUsers: 1000,
          features: ['all'],
        },
        email: 'platform@syspro.com',
      });
      platformOrg = await organizationRepository.save(platformOrg);
      console.log('✅ Created platform organization');
    }

    // 3. Create Default Roles
    const roleRepository = queryRunner.manager.getRepository(UserRole);
    const permissionRepository = queryRunner.manager.getRepository(Permission);

    const defaultRoles = [
      {
        name: 'Super Admin',
        code: 'SUPER_ADMIN',
        description: 'Full system access with all permissions',
        permissions: [
          { resource: '*', action: '*' },
        ],
      },
      {
        name: 'Admin',
        code: 'ADMIN',
        description: 'Administrative access to tenant resources',
        permissions: [
          { resource: 'users', action: 'manage' },
          { resource: 'organizations', action: 'manage' },
          { resource: 'roles', action: 'manage' },
          { resource: 'settings', action: 'manage' },
        ],
      },
      {
        name: 'Manager',
        code: 'MANAGER',
        description: 'Management access to assigned resources',
        permissions: [
          { resource: 'users', action: 'read' },
          { resource: 'organizations', action: 'read' },
          { resource: 'crm', action: 'manage' },
          { resource: 'projects', action: 'manage' },
          { resource: 'reports', action: 'read' },
        ],
      },
      {
        name: 'User',
        code: 'USER',
        description: 'Standard user access',
        permissions: [
          { resource: 'profile', action: 'manage' },
          { resource: 'crm', action: 'read' },
          { resource: 'projects', action: 'read' },
        ],
      },
      {
        name: 'Viewer',
        code: 'VIEWER',
        description: 'Read-only access',
        permissions: [
          { resource: 'profile', action: 'read' },
          { resource: '*', action: 'read' },
        ],
      },
    ];

    const createdRoles: UserRole[] = [];

    for (const roleData of defaultRoles) {
      let role = await roleRepository.findOne({
        where: { tenantId: platformTenant.id, code: roleData.code },
      });

      if (!role) {
        role = roleRepository.create({
          name: roleData.name,
          code: roleData.code,
          description: roleData.description,
          tenantId: platformTenant.id,
        });
        role = await roleRepository.save(role);

        // Create permissions for this role
        for (const permData of roleData.permissions) {
          const permission = permissionRepository.create({
            resource: permData.resource,
            action: permData.action,
            roleId: role.id,
          });
          await permissionRepository.save(permission);
        }

        console.log(`✅ Created role: ${role.name}`);
      }

      createdRoles.push(role);
    }

    // 4. Create Super Admin User
    const userRepository = queryRunner.manager.getRepository(User);
    let superAdmin = await userRepository.findOne({
      where: { email: 'admin@syspro.com', tenantId: platformTenant.id },
    });

    if (!superAdmin) {
      const hashedPassword = await bcrypt.hash('Admin@123', 12);
      const superAdminRole = createdRoles.find(role => role.code === 'SUPER_ADMIN');

      superAdmin = userRepository.create({
        email: 'admin@syspro.com',
        firstName: 'Super',
        lastName: 'Admin',
        password: hashedPassword,
        status: UserStatus.ACTIVE,
        isActive: true,
        emailVerified: true,
        tenantId: platformTenant.id,
        organizationId: platformOrg.id,
        roles: superAdminRole ? [superAdminRole] : [],
      });
      superAdmin = await userRepository.save(superAdmin);
      console.log('✅ Created super admin user');
    }

    // 5. Create Default Subscription
    const subscriptionRepository = queryRunner.manager.getRepository(Subscription);
    let subscription = await subscriptionRepository.findOne({
      where: { tenantId: platformTenant.id },
    });

    if (!subscription) {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days trial

      subscription = subscriptionRepository.create({
        tenantId: platformTenant.id,
        planId: 'enterprise-trial',
        status: SubscriptionStatus.TRIALING,
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
        trialEnd: trialEnd,
        cancelAtPeriodEnd: false,
      });
      await subscriptionRepository.save(subscription);
      console.log('✅ Created trial subscription');
    }

    await queryRunner.commitTransaction();
    console.log('🎉 Initial seed completed successfully!');

    // Log credentials for easy access
    console.log('\n📋 Default Credentials:');
    console.log('Email: admin@syspro.com');
    console.log('Password: Admin@123');
    console.log('Tenant ID:', platformTenant.id);
    console.log('Organization ID:', platformOrg.id);

  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await queryRunner.release();
  }
}