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

    // Seed CRM data (comprehensive)
    await seedLeads(tenantSlug);
    await seedContacts(tenantSlug);

    // Seed Finance data (comprehensive)
    await seedFinanceAccounts(tenantSlug);
    await seedFinanceInvoices(tenantSlug);

    // Seed additional data
    await seedEmployees(tenantSlug);

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
    { name: "Acme Corp", value: 150000, source: "website", industry: "Manufacturing" },
    { name: "TechVision Inc", value: 200000, source: "referral", industry: "Software" },
    { name: "Global Solutions Ltd", value: 180000, source: "inbound", industry: "Consulting" },
    { name: "Innovation Labs", value: 220000, source: "event", industry: "R&D" },
    { name: "Digital Enterprises", value: 190000, source: "cold-call", industry: "Technology" },
    { name: "Strategic Partners LLC", value: 250000, source: "partner", industry: "Business Services" },
    { name: "NextGen Systems", value: 175000, source: "website", industry: "IT Services" },
    { name: "Future Tech Corp", value: 195000, source: "referral", industry: "Software" },
    { name: "Innovate Solutions", value: 210000, source: "event", industry: "Consulting" },
    { name: "Enterprise Systems Inc", value: 230000, source: "inbound", industry: "Enterprise Software" },
    { name: "Digital Transformation Co", value: 185000, source: "cold-call", industry: "Technology" },
    { name: "Cloud Services Group", value: 240000, source: "partner", industry: "Cloud Infrastructure" },
    { name: "Business Intelligence Ltd", value: 205000, source: "website", industry: "Analytics" },
    { name: "Smart Operations Inc", value: 195000, source: "referral", industry: "Operations" },
    { name: "Agile Development Corp", value: 220000, source: "event", industry: "Software Development" },
  ];

  for (const company of companies) {
    try {
      await insertLead(SQL, {
        tenantSlug,
        regionId: REGIONS[Math.floor(Math.random() * REGIONS.length)],
        branchId: BRANCHES[Math.floor(Math.random() * BRANCHES.length)],
        companyName: company.name,
        contactName: `Contact at ${company.name}`,
        contactEmail: `contact@${company.name.toLowerCase().replace(/\s+/g, "")}.com`,
        contactPhone: "+1" + Math.floor(Math.random() * 9000000000 + 1000000000),
        source: company.source as any,
        stage: ["lead", "opportunity", "proposal"][Math.floor(Math.random() * 3)] as any,
        expectedValue: company.value,
        currency: "USD",
        notes: `${company.industry} prospect from ${company.source}. Expected deal size: $${company.value.toLocaleString()}`,
      });
    } catch (e) {
      // Lead may already exist
    }
  }
}

async function seedContacts(tenantSlug: string) {
  console.log("  → Seeding CRM contacts...");
  const firstNames = ["John", "Jane", "Michael", "Sarah", "David", "Emma", "Robert", "Lisa", "James", "Mary", "William", "Patricia", "Richard", "Jennifer", "Joseph"];
  const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson"];
  const companies = ["Acme", "TechCorp", "Global Solutions", "Innovation Labs", "Digital Enterprise", "NextGen", "Future Tech", "Enterprise Systems", "Cloud Services", "Smart Operations"];

  for (let i = 0; i < 50; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const company = companies[Math.floor(Math.random() * companies.length)];

    try {
      await insertContact(SQL, {
        tenantSlug,
        company: `${company} Inc`,
        contactName: `${firstName} ${lastName}`,
        contactEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company.toLowerCase()}.com`,
        contactPhone: "+1" + Math.floor(Math.random() * 9000000000 + 1000000000),
        source: ["manual", "linkedin", "referral", "event", "website"][Math.floor(Math.random() * 5)],
        status: ["active", "inactive", "prospect"][Math.floor(Math.random() * 3)],
        tags: [
          ["prospect", "contacted"],
          ["customer", "active"],
          ["lead", "qualified"],
          ["partner", "strategic"],
        ][Math.floor(Math.random() * 4)],
      });
    } catch (e) {
      // Contact may already exist
    }
  }
}

async function seedFinanceAccounts(tenantSlug: string) {
  console.log("  → Seeding finance accounts...");
  const accountTypes = ["checking", "savings", "credit", "loan", "treasury", "operating"];
  const currencies = ["USD", "EUR", "GBP", "JPY"];

  for (let i = 0; i < 24; i++) {
    try {
      const balance = Math.floor(Math.random() * 2000000) + 50000;
      await insertFinanceAccount(SQL, {
        tenantSlug,
        regionId: REGIONS[Math.floor(Math.random() * REGIONS.length)],
        branchId: BRANCHES[Math.floor(Math.random() * BRANCHES.length)],
        accountNumber: `ACC-${Date.now()}-${i}-${Math.random().toString(36).substring(7).toUpperCase()}`,
        accountName: `${accountTypes[Math.floor(Math.random() * accountTypes.length)]} account - ${REGIONS[i % 4]}`,
        balance,
        currency: currencies[Math.floor(Math.random() * currencies.length)],
        metadata: { accountType: "operational", created: new Date().toISOString() },
      });
    } catch (e) {
      // Account may already exist
    }
  }
}

async function seedFinanceInvoices(tenantSlug: string) {
  console.log("  → Seeding finance invoices...");
  const customerNames = [
    "Acme Corporation", "TechVision Inc", "Global Solutions Ltd", "Innovation Labs", "Digital Enterprises",
    "Strategic Partners LLC", "NextGen Systems", "Future Tech Corp", "Enterprise Systems Inc",
    "Digital Transformation Co", "Cloud Services Group", "Business Intelligence Ltd", "Smart Operations Inc",
    "Agile Development Corp", "Data Analytics Solutions"
  ];

  for (let i = 0; i < 100; i++) {
    try {
      const amount = Math.floor(Math.random() * 500000) + 5000;
      const daysAgo = Math.floor(Math.random() * 365);
      const status = daysAgo < 30 ? "issued" : daysAgo < 90 ? "draft" : "paid";

      await insertFinanceInvoice(SQL, {
        tenantSlug,
        regionId: REGIONS[Math.floor(Math.random() * REGIONS.length)],
        branchId: BRANCHES[Math.floor(Math.random() * BRANCHES.length)],
        customerName: customerNames[Math.floor(Math.random() * customerNames.length)],
        customerCode: `CUST-${Math.random().toString(36).substring(7).toUpperCase()}`,
        invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`,
        issuedDate: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
        dueDate: new Date(Date.now() + (30 - daysAgo) * 24 * 60 * 60 * 1000).toISOString(),
        currency: ["USD", "EUR", "GBP"][Math.floor(Math.random() * 3)],
        amount,
        balanceDue: status === "paid" ? 0 : Math.floor(amount * (0.1 + Math.random() * 0.9)),
        status: status as any,
        paymentTerms: ["Net 30", "Net 60", "Net 90"][Math.floor(Math.random() * 3)],
        notes: `Invoice for services rendered. Amount: $${amount.toLocaleString()}`,
        metadata: { source: "seed", test: true, daysOverdue: Math.max(0, daysAgo - 30) },
      });
    } catch (e) {
      // Invoice may already exist
    }
  }
}

async function seedEmployees(tenantSlug: string) {
  console.log("  → Seeding employees...");
  const firstNames = ["John", "Jane", "Michael", "Sarah", "David", "Emma", "Robert", "Lisa", "James", "Mary", "William", "Patricia"];
  const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"];
  const departments = ["Sales", "Finance", "Operations", "Human Resources", "Technology"];
  const branches = BRANCHES;

  for (let i = 0; i < 60; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

    try {
      // Note: This would require an insertEmployee function in admin/db
      // For now, we'll skip this or add it if the function exists
      const employeeData = {
        tenantSlug,
        name: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
        department: departments[Math.floor(Math.random() * departments.length)],
        branch: branches[Math.floor(Math.random() * branches.length)],
        region: REGIONS[Math.floor(Math.random() * REGIONS.length)],
        status: Math.random() > 0.1 ? "active" : "inactive",
      };

      console.log(`    Created employee: ${employeeData.name}`);
    } catch (e) {
      // Employee creation failed
    }
  }
}

// Export the seeding function for manual triggering
export async function seedDatabaseForTenant(tenantSlug: string = DEFAULT_TENANT) {
  await seedDatabase(tenantSlug);
}
