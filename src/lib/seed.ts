import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { ensureAdminTables, insertRole, insertDepartment, insertApprovalRoute, insertAccessControl, insertWorkflow } from "@/lib/admin/db";
import { ensureCrmTables, insertLead, insertContact } from "@/lib/crm/db";
import { ensureFinanceTables, insertFinanceAccount, insertFinanceInvoice } from "@/lib/finance/db";
import { ensureTenantOrgStructureTable } from "@/lib/org-tree";

const SQL = getSql();
const DEFAULT_TENANT = "kreatix-default";
const REGIONS = ["Global HQ", "Americas", "EMEA", "APAC"];
const BRANCHES = ["New York", "London", "Singapore", "São Paulo"];

/**
 * Seed comprehensive mock data for development and testing
 */
export async function seedDatabase(tenantSlug = DEFAULT_TENANT) {
  console.log(`🌱 Seeding database for tenant: ${tenantSlug}`);

  try {
    // Ensure all tables exist
    await ensureAdminTables(SQL);
    await ensureCrmTables(SQL);
    await ensureFinanceTables(SQL);

    // Seed admin data
    await seedRoles(tenantSlug);
    await seedDepartments(tenantSlug);
    await seedAccessControl(tenantSlug);
    await seedApprovalRoutes(tenantSlug);
    await seedWorkflows(tenantSlug);

    // Seed CRM data
    await seedLeads(tenantSlug);
    await seedContacts(tenantSlug);

    // Seed Finance data
    await seedFinanceAccounts(tenantSlug);
    await seedFinanceInvoices(tenantSlug);

    console.log("✅ Database seeding completed successfully");
  } catch (error) {
    console.error("❌ Database seeding failed:", error);
    throw error;
  }
}

async function seedRoles(tenantSlug: string) {
  console.log("  → Seeding roles...");
  const roles = [
    { name: "Admin", scope: "tenant", permissions: ["crm.read", "crm.write", "finance.read", "finance.write", "people.read", "people.write", "all"] },
    { name: "Manager", scope: "region", permissions: ["crm.read", "crm.write", "finance.read", "people.read", "people.write"] },
    { name: "Sales Officer", scope: "branch", permissions: ["crm.read", "crm.write", "finance.read"] },
    { name: "Finance Analyst", scope: "region", permissions: ["finance.read", "finance.write"] },
    { name: "HR Officer", scope: "tenant", permissions: ["people.read", "people.write"] },
  ];

  for (const role of roles) {
    try {
      await insertRole({ tenantSlug, name: role.name, scope: role.scope as any, permissions: role.permissions });
    } catch (e) {
      // Role may already exist
    }
  }
}

async function seedDepartments(tenantSlug: string) {
  console.log("  → Seeding departments...");
  const departments = [
    { name: "Sales", description: "Sales and business development" },
    { name: "Finance", description: "Finance and accounting" },
    { name: "Operations", description: "Operations and logistics" },
    { name: "Human Resources", description: "HR and people management" },
    { name: "Technology", description: "IT and technology" },
  ];

  for (const dept of departments) {
    try {
      await insertDepartment({ tenantSlug, name: dept.name, description: dept.description });
    } catch (e) {
      // Department may already exist
    }
  }
}

async function seedAccessControl(tenantSlug: string) {
  console.log("  → Seeding access controls...");
  const modules = ["crm", "finance", "people", "projects", "billing", "integrations"];

  for (const module of modules) {
    try {
      await insertAccessControl({
        tenantSlug,
        roleId: randomUUID(),
        roleName: "Default Role",
        moduleAccess: [
          { module, read: true, write: ["crm", "finance"].includes(module), admin: false },
        ],
      });
    } catch (e) {
      // Access control may already exist
    }
  }
}

async function seedApprovalRoutes(tenantSlug: string) {
  console.log("  → Seeding approval routes...");
  const routes = [
    {
      name: "Standard Approval",
      steps: [
        { step: 1, owners: ["manager"], slaHours: 24 },
        { step: 2, owners: ["director"], slaHours: 48 },
      ],
    },
    {
      name: "Expedited Approval",
      steps: [
        { step: 1, owners: ["manager"], slaHours: 4 },
        { step: 2, owners: ["cfo"], slaHours: 8 },
      ],
    },
    {
      name: "Budget Approval",
      steps: [
        { step: 1, owners: ["manager"], slaHours: 24 },
        { step: 2, owners: ["finance-lead"], slaHours: 48 },
        { step: 3, owners: ["cfo"], slaHours: 72 },
      ],
    },
  ];

  for (const route of routes) {
    try {
      await insertApprovalRoute({
        tenantSlug,
        name: route.name,
        steps: route.steps,
      });
    } catch (e) {
      // Route may already exist
    }
  }
}

async function seedWorkflows(tenantSlug: string) {
  console.log("  → Seeding workflows...");
  const workflows = [
    {
      name: "Onboarding",
      type: "onboarding",
      description: "New employee onboarding process",
      steps: [
        { step: 1, action: "HR Review", assignee: "hr-team" },
        { step: 2, action: "IT Setup", assignee: "it-team" },
        { step: 3, action: "Manager Orientation", assignee: "manager" },
        { step: 4, action: "Team Introduction", assignee: "team-lead" },
      ],
    },
    {
      name: "Promotion",
      type: "promotion",
      description: "Employee promotion workflow",
      steps: [
        { step: 1, action: "Manager Nomination", assignee: "manager" },
        { step: 2, action: "HR Review", assignee: "hr-director" },
        { step: 3, action: "Executive Approval", assignee: "executive" },
      ],
    },
    {
      name: "Exit",
      type: "exit",
      description: "Employee exit process",
      steps: [
        { step: 1, action: "Offboarding", assignee: "hr-team" },
        { step: 2, action: "IT Deprovisioning", assignee: "it-team" },
        { step: 3, action: "Knowledge Transfer", assignee: "manager" },
      ],
    },
  ];

  for (const wf of workflows) {
    try {
      await insertWorkflow({
        tenantSlug,
        name: wf.name,
        type: wf.type,
        steps: wf.steps,
      });
    } catch (e) {
      // Workflow may already exist
    }
  }
}

async function seedLeads(tenantSlug: string) {
  console.log("  → Seeding CRM leads...");
  const companies = [
    { name: "Acme Corp", value: 150000, source: "website" },
    { name: "TechVision Inc", value: 200000, source: "referral" },
    { name: "Global Solutions Ltd", value: 180000, source: "inbound" },
    { name: "Innovation Labs", value: 220000, source: "event" },
    { name: "Digital Enterprises", value: 190000, source: "cold-call" },
  ];

  for (const company of companies) {
    try {
      await insertLead(SQL, {
        tenantSlug,
        regionId: REGIONS[Math.floor(Math.random() * REGIONS.length)],
        branchId: BRANCHES[Math.floor(Math.random() * BRANCHES.length)],
        companyName: company.name,
        contactName: `John Smith at ${company.name}`,
        contactEmail: `contact@${company.name.toLowerCase().replace(/\s+/g, "")}.com`,
        contactPhone: "+1" + Math.floor(Math.random() * 9000000000 + 1000000000),
        source: company.source as any,
        stage: ["lead", "opportunity", "proposal"][Math.floor(Math.random() * 3)] as any,
        expectedValue: company.value,
        currency: "USD",
        notes: `Prospect from ${company.source}`,
      });
    } catch (e) {
      // Lead may already exist
    }
  }
}

async function seedContacts(tenantSlug: string) {
  console.log("  → Seeding CRM contacts...");
  const firstNames = ["John", "Jane", "Michael", "Sarah", "David", "Emma", "Robert", "Lisa"];
  const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"];

  for (let i = 0; i < 15; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const company = `Company ${Math.floor(Math.random() * 100)}`;

    try {
      await insertContact(SQL, {
        tenantSlug,
        company,
        contactName: `${firstName} ${lastName}`,
        contactEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company.toLowerCase().replace(/\s+/g, "")}.com`,
        contactPhone: "+1" + Math.floor(Math.random() * 9000000000 + 1000000000),
        source: "manual",
        status: "active",
        tags: ["prospect", "contacted"],
      });
    } catch (e) {
      // Contact may already exist
    }
  }
}

async function seedFinanceAccounts(tenantSlug: string) {
  console.log("  → Seeding finance accounts...");
  const accountTypes = ["checking", "savings", "credit", "loan"];
  const currencies = ["USD", "EUR", "GBP"];

  for (let i = 0; i < 8; i++) {
    try {
      const balance = Math.floor(Math.random() * 500000) + 10000;
      await insertFinanceAccount(SQL, {
        tenantSlug,
        regionId: REGIONS[Math.floor(Math.random() * REGIONS.length)],
        branchId: BRANCHES[Math.floor(Math.random() * BRANCHES.length)],
        accountNumber: `ACC-${Math.random().toString(36).substring(7).toUpperCase()}`,
        accountName: `${accountTypes[Math.floor(Math.random() * accountTypes.length)]} account`,
        balance,
        currency: currencies[Math.floor(Math.random() * currencies.length)],
        metadata: { accountType: "operational" },
      });
    } catch (e) {
      // Account may already exist
    }
  }
}

async function seedFinanceInvoices(tenantSlug: string) {
  console.log("  → Seeding finance invoices...");

  for (let i = 0; i < 20; i++) {
    try {
      const amount = Math.floor(Math.random() * 100000) + 1000;
      const daysAgo = Math.floor(Math.random() * 90);

      await insertFinanceInvoice(SQL, {
        tenantSlug,
        regionId: REGIONS[Math.floor(Math.random() * REGIONS.length)],
        branchId: BRANCHES[Math.floor(Math.random() * BRANCHES.length)],
        customerName: `Customer ${Math.floor(Math.random() * 1000)}`,
        customerCode: `CUST-${Math.random().toString(36).substring(7).toUpperCase()}`,
        invoiceNumber: `INV-${Date.now()}-${i}`,
        issuedDate: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
        dueDate: new Date(Date.now() + (30 - daysAgo) * 24 * 60 * 60 * 1000).toISOString(),
        currency: "USD",
        amount,
        balanceDue: Math.floor(amount * (0.5 + Math.random() * 0.5)),
        status: ["draft", "issued", "paid"][Math.floor(Math.random() * 3)] as any,
        paymentTerms: "Net 30",
        notes: "Sample invoice for testing",
        metadata: { source: "seed", test: true },
      });
    } catch (e) {
      // Invoice may already exist
    }
  }
}

// Export the seeding function for manual triggering
export async function seedDatabaseForTenant(tenantSlug: string = DEFAULT_TENANT) {
  await seedDatabase(tenantSlug);
}
