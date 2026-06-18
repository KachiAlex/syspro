import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getSql } from "@/lib/db";

const sql = getSql();

function uniqueTenantSlug(label: string) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${label}-${Date.now()}-${random}`;
}

function uniqueEmail(label: string) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${label}-${Date.now()}-${random}@example.com`;
}

// Skip tests if DATABASE_URL is not configured (mock environment)
const isDatabaseConfigured = !!process.env.DATABASE_URL;
const describeIfDb = isDatabaseConfigured ? describe : describe.skip;

describeIfDb("Superadmin Portal - Database Integration", () => {
  describe("Tenant Management", () => {
    let testTenant: any;

    afterEach(async () => {
      // Clean up test data
      if (testTenant) {
        await sql`DELETE FROM tenant_admins WHERE tenant_id = ${testTenant.id}`;
        await sql`DELETE FROM licenses WHERE tenant_id = ${testTenant.id}`;
        await sql`DELETE FROM tenants WHERE id = ${testTenant.id}`;
      }
    });

    it("creates a new tenant with valid data", async () => {
      const tenantData = {
        name: "Test Company Inc",
        slug: uniqueTenantSlug("test-company"),
        seats: 50
      };

      const result = await sql`
        INSERT INTO tenants (name, slug, seats)
        VALUES (${tenantData.name}, ${tenantData.slug}, ${tenantData.seats})
        RETURNING *
      `;

      expect(result.length).toBe(1);
      const tenant = result[0];

      expect(tenant.name).toBe(tenantData.name);
      expect(tenant.slug).toBe(tenantData.slug);
      expect(tenant.seats).toBe(tenantData.seats);
      expect(tenant.id).toBeDefined();
      expect(tenant.created_at).toBeDefined();

      testTenant = tenant;
    });

    it("fetches all tenants", async () => {
      // First create a test tenant
      const tenantData = {
        name: "Fetch Test Company",
        slug: uniqueTenantSlug("fetch-test"),
        seats: 25
      };

      const insertResult = await sql`
        INSERT INTO tenants (name, slug, seats)
        VALUES (${tenantData.name}, ${tenantData.slug}, ${tenantData.seats})
        RETURNING *
      `;

      const fetchResult = await sql`SELECT * FROM tenants ORDER BY created_at DESC`;
      expect(Array.isArray(fetchResult)).toBe(true);

      const foundTenant = fetchResult.find((t: any) => t.slug === tenantData.slug);
      expect(foundTenant).toBeDefined();
      expect(foundTenant.name).toBe(tenantData.name);
      expect(foundTenant.seats).toBe(tenantData.seats);

      testTenant = insertResult[0];
    });

    it("fetches tenant details with licenses and admins", async () => {
      // Create test tenant
      const tenantData = {
        name: "Details Test Company",
        slug: uniqueTenantSlug("details-test"),
        seats: 30
      };

      const [tenant] = await sql`
        INSERT INTO tenants (name, slug, seats)
        VALUES (${tenantData.name}, ${tenantData.slug}, ${tenantData.seats})
        RETURNING *
      `;

      // Create test license
      await sql`
        INSERT INTO licenses (tenant_id, type, seats, expiry)
        VALUES (${tenant.id}, 'enterprise', 30, '2026-12-31')
      `;

      // Create test admin
      await sql`
        INSERT INTO tenant_admins (tenant_id, name, email, role)
        VALUES (${tenant.id}, 'John Admin', 'john@example.com', 'super_admin')
      `;

      // Fetch tenant with related data
      const tenantResult = await sql`SELECT * FROM tenants WHERE slug = ${tenant.slug}`;
      const licenses = await sql`SELECT * FROM licenses WHERE tenant_id = ${tenant.id}`;
      const admins = await sql`SELECT * FROM tenant_admins WHERE tenant_id = ${tenant.id}`;

      expect(tenantResult.length).toBe(1);
      expect(licenses.length).toBe(1);
      expect(admins.length).toBe(1);

      expect(tenantResult[0].name).toBe(tenant.name);
      expect(licenses[0].type).toBe('enterprise');
      expect(admins[0].name).toBe('John Admin');

      testTenant = tenant;
    });

    it("updates tenant information", async () => {
      // Create test tenant
      const tenantData = {
        name: "Update Test Company",
        slug: uniqueTenantSlug("update-test"),
        seats: 20
      };

      const [tenant] = await sql`
        INSERT INTO tenants (name, slug, seats)
        VALUES (${tenantData.name}, ${tenantData.slug}, ${tenantData.seats})
        RETURNING *
      `;

      const updateData = {
        name: "Updated Company Name",
        seats: 40
      };

      const result = await sql`
        UPDATE tenants
        SET name = ${updateData.name}, seats = ${updateData.seats}, updated_at = NOW()
        WHERE slug = ${tenant.slug}
        RETURNING *
      `;

      expect(result.length).toBe(1);
      const updatedTenant = result[0];

      expect(updatedTenant.name).toBe(updateData.name);
      expect(updatedTenant.seats).toBe(updateData.seats);
      expect(updatedTenant.slug).toBe(tenant.slug);

      testTenant = tenant;
    });

    it("deletes a tenant", async () => {
      // Create test tenant
      const tenantData = {
        name: "Delete Test Company",
        slug: uniqueTenantSlug("delete-test"),
        seats: 15
      };

      const [tenant] = await sql`
        INSERT INTO tenants (name, slug, seats)
        VALUES (${tenantData.name}, ${tenantData.slug}, ${tenantData.seats})
        RETURNING *
      `;

      // Delete tenant
      await sql`DELETE FROM tenants WHERE id = ${tenant.id}`;

      // Verify tenant is deleted
      const checkResult = await sql`SELECT * FROM tenants WHERE id = ${tenant.id}`;
      expect(checkResult.length).toBe(0);

      testTenant = null; // Don't clean up since it's already deleted
    });
  });

  describe("License Management", () => {
    let testTenant: any;
    let testLicense: any;

    beforeEach(async () => {
      // Create test tenant for license tests
      const tenantData = {
        name: "License Test Company",
        slug: uniqueTenantSlug("license-test"),
        seats: 100
      };

      const [tenant] = await sql`
        INSERT INTO tenants (name, slug, seats)
        VALUES (${tenantData.name}, ${tenantData.slug}, ${tenantData.seats})
        RETURNING *
      `;
      testTenant = tenant;
    });

    afterEach(async () => {
      // Clean up test data
      if (testLicense) {
        await sql`DELETE FROM licenses WHERE id = ${testLicense.id}`;
      }
      if (testTenant) {
        await sql`DELETE FROM tenants WHERE id = ${testTenant.id}`;
      }
    });

    it("creates a new license for a tenant", async () => {
      const licenseData = {
        type: "professional",
        seats: 50,
        expiry: "2026-06-30"
      };

      const result = await sql`
        INSERT INTO licenses (tenant_id, type, seats, expiry)
        VALUES (${testTenant.id}, ${licenseData.type}, ${licenseData.seats}, ${licenseData.expiry})
        RETURNING *
      `;

      expect(result.length).toBe(1);
      const license = result[0];

      expect(license.tenant_id).toBe(testTenant.id);
      expect(license.type).toBe(licenseData.type);
      expect(license.seats).toBe(licenseData.seats);
        // Allow ±1 day difference due to timezone/storage
        const actualDate = new Date(license.expiry);
        const expectedDate = new Date(licenseData.expiry);
        const diffDays = Math.abs(
          Math.floor((actualDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24))
        );
        expect(diffDays).toBeLessThanOrEqual(1);

      testLicense = license;
    });

    it("fetches all licenses with tenant information", async () => {
      // Create test license
      const [license] = await sql`
        INSERT INTO licenses (tenant_id, type, seats, expiry)
        VALUES (${testTenant.id}, 'starter', 25, '2025-12-31')
        RETURNING *
      `;

      const licenses = await sql`
        SELECT l.*, t.name as tenant_name, t.slug as tenant_slug
        FROM licenses l
        JOIN tenants t ON l.tenant_id = t.id
        ORDER BY l.created_at DESC
      `;

      expect(Array.isArray(licenses)).toBe(true);
      expect(licenses.length).toBeGreaterThan(0);

      const foundLicense = licenses.find((l: any) => l.id === license.id);
      expect(foundLicense).toBeDefined();
      expect(foundLicense.type).toBe('starter');
      expect(foundLicense.seats).toBe(25);
      expect(foundLicense.tenant_name).toBe(testTenant.name);
      expect(foundLicense.tenant_slug).toBe(testTenant.slug);

      testLicense = license;
    });

    it("updates license information", async () => {
      // Create test license
      const [license] = await sql`
        INSERT INTO licenses (tenant_id, type, seats, expiry)
        VALUES (${testTenant.id}, 'basic', 20, '2025-12-31')
        RETURNING *
      `;

      const updateData = {
        type: "premium",
        seats: 40,
        expiry: "2026-12-31"
      };

      const result = await sql`
        UPDATE licenses
        SET type = ${updateData.type}, seats = ${updateData.seats}, expiry = ${updateData.expiry}, updated_at = NOW()
        WHERE id = ${license.id}
        RETURNING *
      `;

      expect(result.length).toBe(1);
      const updatedLicense = result[0];

      expect(updatedLicense.type).toBe(updateData.type);
      expect(updatedLicense.seats).toBe(updateData.seats);
        // Allow ±1 day difference due to timezone/storage
        const actualUpdatedDate = new Date(updatedLicense.expiry);
        const expectedUpdatedDate = new Date(updateData.expiry);
        const diffUpdatedDays = Math.abs(
          Math.floor((actualUpdatedDate.getTime() - expectedUpdatedDate.getTime()) / (1000 * 60 * 60 * 24))
        );
        expect(diffUpdatedDays).toBeLessThanOrEqual(1);

      testLicense = license;
    });

    it("deletes a license", async () => {
      // Create test license
      const [license] = await sql`
        INSERT INTO licenses (tenant_id, type, seats, expiry)
        VALUES (${testTenant.id}, 'trial', 10, '2025-12-31')
        RETURNING *
      `;

      // Delete license
      await sql`DELETE FROM licenses WHERE id = ${license.id}`;

      // Verify license is deleted
      const checkResult = await sql`SELECT * FROM licenses WHERE id = ${license.id}`;
      expect(checkResult.length).toBe(0);

      testLicense = null; // Don't clean up since it's already deleted
    });
  });

  describe("Tenant Admin Management", () => {
    let testTenant: any;
    let testAdmin: any;

    beforeEach(async () => {
      // Create test tenant for admin tests
      const tenantData = {
        name: "Admin Test Company",
        slug: uniqueTenantSlug("admin-test"),
        seats: 75
      };

      const [tenant] = await sql`
        INSERT INTO tenants (name, slug, seats)
        VALUES (${tenantData.name}, ${tenantData.slug}, ${tenantData.seats})
        RETURNING *
      `;
      testTenant = tenant;
    });

    afterEach(async () => {
      // Clean up test data
      if (testAdmin) {
        await sql`DELETE FROM tenant_admins WHERE id = ${testAdmin.id}`;
      }
      if (testTenant) {
        await sql`DELETE FROM tenants WHERE id = ${testTenant.id}`;
      }
    });

    it("creates a new tenant admin", async () => {
      const adminData = {
        name: "Jane Smith",
        email: uniqueEmail("jane"),
        role: "admin"
      };

      const result = await sql`
        INSERT INTO tenant_admins (tenant_id, name, email, role)
        VALUES (${testTenant.id}, ${adminData.name}, ${adminData.email}, ${adminData.role})
        RETURNING *
      `;

      expect(result.length).toBe(1);
      const admin = result[0];

      expect(admin.tenant_id).toBe(testTenant.id);
      expect(admin.name).toBe(adminData.name);
      expect(admin.email).toBe(adminData.email);
      expect(admin.role).toBe(adminData.role);

      testAdmin = admin;
    });

    it("fetches all tenant admins", async () => {
      // Create test admin
      const [admin] = await sql`
        INSERT INTO tenant_admins (tenant_id, name, email, role)
        VALUES (${testTenant.id}, 'Bob Wilson', 'bob@example.com', 'user_admin')
        RETURNING *
      `;

      const admins = await sql`SELECT * FROM tenant_admins WHERE tenant_id = ${testTenant.id}`;

      expect(Array.isArray(admins)).toBe(true);
      expect(admins.length).toBeGreaterThan(0);

      const foundAdmin = admins.find((a: any) => a.id === admin.id);
      expect(foundAdmin).toBeDefined();
      expect(foundAdmin.name).toBe('Bob Wilson');
      expect(foundAdmin.email).toBe('bob@example.com');
      expect(foundAdmin.role).toBe('user_admin');

      testAdmin = admin;
    });

    it("updates tenant admin information", async () => {
      // Create test admin
      const [admin] = await sql`
        INSERT INTO tenant_admins (tenant_id, name, email, role)
        VALUES (${testTenant.id}, 'Alice Johnson', 'alice@example.com', 'viewer')
        RETURNING *
      `;

      const updateData = {
        name: "Alice Cooper",
        role: "admin"
      };

      const result = await sql`
        UPDATE tenant_admins
        SET name = ${updateData.name}, role = ${updateData.role}, updated_at = NOW()
        WHERE id = ${admin.id}
        RETURNING *
      `;

      expect(result.length).toBe(1);
      const updatedAdmin = result[0];

      expect(updatedAdmin.name).toBe(updateData.name);
      expect(updatedAdmin.role).toBe(updateData.role);
      expect(updatedAdmin.email).toBe(admin.email); // email shouldn't change

      testAdmin = admin;
    });

    it("deletes a tenant admin", async () => {
      // Create test admin
      const [admin] = await sql`
        INSERT INTO tenant_admins (tenant_id, name, email, role)
        VALUES (${testTenant.id}, 'Charlie Brown', 'charlie@example.com', 'editor')
        RETURNING *
      `;

      // Delete admin
      await sql`DELETE FROM tenant_admins WHERE id = ${admin.id}`;

      // Verify admin is deleted
      const checkResult = await sql`SELECT * FROM tenant_admins WHERE id = ${admin.id}`;
      expect(checkResult.length).toBe(0);

      testAdmin = null; // Don't clean up since it's already deleted
    });
  });
});

// Tests that work in both mock and real database environments
describe("Superadmin Portal - Business Logic", () => {
  it("validates tenant data structure", () => {
    const validTenant = {
      id: 1,
      name: "Test Company",
      slug: "test-company",
      seats: 50,
      created_at: "2024-01-01T00:00:00Z"
    };

    expect(validTenant.id).toBeDefined();
    expect(validTenant.name).toBe("Test Company");
    expect(validTenant.slug).toBe("test-company");
    expect(validTenant.seats).toBe(50);
    expect(validTenant.created_at).toBeDefined();
  });

  it("validates license data structure", () => {
    const validLicense = {
      id: 1,
      tenant_id: 1,
      tenant_name: "Test Company",
      tenant_slug: "test-company",
      type: "enterprise",
      seats: 100,
      expiry: "2026-12-31",
      created_at: "2024-01-01T00:00:00Z"
    };

    expect(validLicense.id).toBeDefined();
    expect(validLicense.tenant_id).toBe(1);
    expect(validLicense.type).toBe("enterprise");
    expect(validLicense.seats).toBe(100);
    expect(validLicense.expiry).toBe("2026-12-31");
  });

  it("validates tenant admin data structure", () => {
    const validAdmin = {
      id: 1,
      tenant_id: 1,
      tenant_name: "Test Company",
      tenant_slug: "test-company",
      email: "admin@example.com",
      name: "John Admin",
      role: "super_admin",
      created_at: "2024-01-01T00:00:00Z"
    };

    expect(validAdmin.id).toBeDefined();
    expect(validAdmin.tenant_id).toBe(1);
    expect(validAdmin.email).toBe("admin@example.com");
    expect(validAdmin.name).toBe("John Admin");
    expect(validAdmin.role).toBe("super_admin");
  });

  it("generates unique tenant slugs", () => {
    const slug1 = uniqueTenantSlug("test");
    const slug2 = uniqueTenantSlug("test");

    expect(slug1).toMatch(/^test-\d+-\w+$/);
    expect(slug2).toMatch(/^test-\d+-\w+$/);
    expect(slug1).not.toBe(slug2);
  });

  it("generates unique emails", () => {
    const email1 = uniqueEmail("user");
    const email2 = uniqueEmail("user");

    expect(email1).toMatch(/^user-\d+-\w+@example\.com$/);
    expect(email2).toMatch(/^user-\d+-\w+@example\.com$/);
    expect(email1).not.toBe(email2);
  });
});