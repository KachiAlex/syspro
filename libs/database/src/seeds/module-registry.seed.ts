import { DataSource } from 'typeorm';
import { ModuleRegistry, ModuleCategory, PricingModel } from '../entities/module-registry.entity';

export async function seedModuleRegistry(dataSource: DataSource): Promise<void> {
  const moduleRepository = dataSource.getRepository(ModuleRegistry);

  // Check if modules already exist
  const existingCount = await moduleRepository.count();
  if (existingCount > 0) {
    console.log('Module registry already seeded, skipping...');
    return;
  }

  const modules: Partial<ModuleRegistry>[] = [
    // Core modules (cannot be disabled)
    {
      name: 'auth',
      displayName: 'Authentication & Authorization',
      description: 'Core authentication and authorization system with role-based access control',
      category: ModuleCategory.CORE,
      version: '1.0.0',
      isCore: true,
      pricingModel: PricingModel.FREE,
      dependencies: [],
      configurationSchema: {
        type: 'object',
        properties: {
          sessionTimeout: { type: 'number', default: 3600 },
          maxLoginAttempts: { type: 'number', default: 5 },
          requireMFA: { type: 'boolean', default: false },
        },
      },
      featureFlags: {
        socialLogin: { default: false, description: 'Enable social media login' },
        sso: { default: false, description: 'Enable single sign-on' },
      },
      apiEndpoints: ['/api/v1/auth/*'],
    },
    {
      name: 'tenant-management',
      displayName: 'Tenant Management',
      description: 'Multi-tenant organization and user management',
      category: ModuleCategory.CORE,
      version: '1.0.0',
      isCore: true,
      pricingModel: PricingModel.FREE,
      dependencies: ['auth'],
      configurationSchema: {
        type: 'object',
        properties: {
          maxUsers: { type: 'number', default: 100 },
          allowSubdomains: { type: 'boolean', default: true },
        },
      },
      featureFlags: {
        customBranding: { default: false, description: 'Enable custom tenant branding' },
      },
      apiEndpoints: ['/api/v1/tenants/*', '/api/v1/users/*', '/api/v1/organizations/*'],
    },

    // Business modules
    {
      name: 'crm',
      displayName: 'Customer Relationship Management',
      description: 'Comprehensive CRM system for managing customer relationships, leads, and sales pipeline',
      category: ModuleCategory.BUSINESS,
      version: '1.2.0',
      pricingModel: PricingModel.PER_USER,
      basePrice: 0,
      perUserPrice: 15.00,
      dependencies: ['auth', 'tenant-management'],
      optionalDependencies: ['notifications', 'analytics'],
      configurationSchema: {
        type: 'object',
        properties: {
          maxLeads: { type: 'number', default: 1000 },
          enableAutoAssignment: { type: 'boolean', default: true },
          pipelineStages: { 
            type: 'array', 
            default: ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'] 
          },
        },
      },
      featureFlags: {
        advancedReporting: { default: false, description: 'Enable advanced CRM reporting' },
        emailIntegration: { default: true, description: 'Enable email integration' },
        mobileApp: { default: true, description: 'Enable mobile app access' },
      },
      apiEndpoints: ['/api/v1/crm/*', '/api/v1/leads/*', '/api/v1/customers/*', '/api/v1/deals/*'],
    },
    {
      name: 'hr',
      displayName: 'Human Resources',
      description: 'Complete HR management system including employee records, attendance, and payroll',
      category: ModuleCategory.BUSINESS,
      version: '1.1.0',
      pricingModel: PricingModel.PER_USER,
      basePrice: 0,
      perUserPrice: 12.00,
      dependencies: ['auth', 'tenant-management'],
      optionalDependencies: ['notifications'],
      configurationSchema: {
        type: 'object',
        properties: {
          workingHours: { type: 'number', default: 8 },
          overtimeRate: { type: 'number', default: 1.5 },
          leaveTypes: { 
            type: 'array', 
            default: ['Annual', 'Sick', 'Personal', 'Maternity', 'Paternity'] 
          },
        },
      },
      featureFlags: {
        timeTracking: { default: true, description: 'Enable time tracking features' },
        performanceReviews: { default: false, description: 'Enable performance review system' },
        payrollIntegration: { default: false, description: 'Enable payroll integration' },
      },
      apiEndpoints: ['/api/v1/hr/*', '/api/v1/employees/*', '/api/v1/attendance/*', '/api/v1/payroll/*'],
    },
    {
      name: 'inventory',
      displayName: 'Inventory Management',
      description: 'Comprehensive inventory and warehouse management system',
      category: ModuleCategory.BUSINESS,
      version: '1.0.0',
      pricingModel: PricingModel.FLAT_RATE,
      basePrice: 49.99,
      perUserPrice: 0,
      dependencies: ['auth', 'tenant-management'],
      optionalDependencies: ['analytics'],
      configurationSchema: {
        type: 'object',
        properties: {
          lowStockThreshold: { type: 'number', default: 10 },
          enableBarcodeScanning: { type: 'boolean', default: true },
          trackSerialNumbers: { type: 'boolean', default: false },
        },
      },
      featureFlags: {
        multiWarehouse: { default: false, description: 'Enable multi-warehouse support' },
        lotTracking: { default: false, description: 'Enable lot/batch tracking' },
        dropShipping: { default: false, description: 'Enable drop shipping features' },
      },
      apiEndpoints: ['/api/v1/inventory/*', '/api/v1/products/*', '/api/v1/warehouses/*'],
    },
    {
      name: 'projects',
      displayName: 'Project Management',
      description: 'Project and task management with Kanban boards, Gantt charts, and time tracking',
      category: ModuleCategory.BUSINESS,
      version: '1.0.0',
      pricingModel: PricingModel.PER_USER,
      basePrice: 0,
      perUserPrice: 10.00,
      dependencies: ['auth', 'tenant-management'],
      optionalDependencies: ['hr', 'notifications'],
      configurationSchema: {
        type: 'object',
        properties: {
          maxProjectsPerUser: { type: 'number', default: 50 },
          enableTimeTracking: { type: 'boolean', default: true },
          defaultProjectTemplate: { type: 'string', default: 'agile' },
        },
      },
      featureFlags: {
        ganttCharts: { default: false, description: 'Enable Gantt chart views' },
        resourceManagement: { default: false, description: 'Enable resource management' },
        budgetTracking: { default: false, description: 'Enable project budget tracking' },
      },
      apiEndpoints: ['/api/v1/projects/*', '/api/v1/tasks/*', '/api/v1/timesheets/*'],
    },

    // Integration modules
    {
      name: 'notifications',
      displayName: 'Notification System',
      description: 'Multi-channel notification system with email, SMS, and push notifications',
      category: ModuleCategory.INTEGRATION,
      version: '1.0.0',
      pricingModel: PricingModel.USAGE_BASED,
      basePrice: 5.00,
      perUserPrice: 0,
      dependencies: ['auth', 'tenant-management'],
      configurationSchema: {
        type: 'object',
        properties: {
          emailProvider: { type: 'string', default: 'sendgrid' },
          smsProvider: { type: 'string', default: 'twilio' },
          enablePushNotifications: { type: 'boolean', default: true },
        },
      },
      featureFlags: {
        emailTemplates: { default: true, description: 'Enable custom email templates' },
        scheduledNotifications: { default: false, description: 'Enable scheduled notifications' },
        notificationHistory: { default: true, description: 'Enable notification history tracking' },
      },
      apiEndpoints: ['/api/v1/notifications/*'],
    },
    {
      name: 'integrations',
      displayName: 'Third-party Integrations',
      description: 'Integration hub for connecting with external services and APIs',
      category: ModuleCategory.INTEGRATION,
      version: '1.0.0',
      pricingModel: PricingModel.FLAT_RATE,
      basePrice: 19.99,
      perUserPrice: 0,
      dependencies: ['auth', 'tenant-management'],
      configurationSchema: {
        type: 'object',
        properties: {
          maxIntegrations: { type: 'number', default: 10 },
          enableWebhooks: { type: 'boolean', default: true },
          rateLimitPerHour: { type: 'number', default: 1000 },
        },
      },
      featureFlags: {
        customIntegrations: { default: false, description: 'Enable custom integration development' },
        dataSync: { default: true, description: 'Enable automatic data synchronization' },
      },
      apiEndpoints: ['/api/v1/integrations/*', '/api/v1/webhooks/*'],
    },

    // Analytics modules
    {
      name: 'analytics',
      displayName: 'Business Analytics',
      description: 'Advanced analytics and reporting with customizable dashboards and KPIs',
      category: ModuleCategory.ANALYTICS,
      version: '1.0.0',
      pricingModel: PricingModel.PER_USER,
      basePrice: 0,
      perUserPrice: 8.00,
      dependencies: ['auth', 'tenant-management'],
      configurationSchema: {
        type: 'object',
        properties: {
          dataRetentionDays: { type: 'number', default: 365 },
          enableRealTimeAnalytics: { type: 'boolean', default: false },
          maxCustomDashboards: { type: 'number', default: 5 },
        },
      },
      featureFlags: {
        predictiveAnalytics: { default: false, description: 'Enable AI-powered predictive analytics' },
        customReports: { default: true, description: 'Enable custom report builder' },
        dataExport: { default: true, description: 'Enable data export functionality' },
      },
      apiEndpoints: ['/api/v1/analytics/*', '/api/v1/reports/*', '/api/v1/dashboards/*'],
    },
  ];

  // Insert modules
  for (const moduleData of modules) {
    const module = moduleRepository.create(moduleData);
    await moduleRepository.save(module);
    console.log(`✓ Created module: ${module.name}`);
  }

  console.log(`✅ Successfully seeded ${modules.length} modules to the registry`);
}