import { neon } from "@neondatabase/serverless";
import { randomUUID } from "crypto";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(connectionString);

async function main() {
  // Get tenant IDs
  const tenants = await sql`select id, slug, name from tenants order by id`;
  console.log("Tenants:", tenants.map((t: any) => `${t.slug} (id=${t.id})`).join(", "));

  const now = new Date();
  const oneYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  // License assignments
  const licenses = [
    {
      tenantSlug: "kreatixtech",
      type: "professional",
      seats: 100,
      status: "active",
      expiry: oneYear.toISOString().slice(0, 10),
    },
    {
      tenantSlug: "syscomptech",
      type: "growth",
      seats: 25,
      status: "active",
      expiry: oneYear.toISOString().slice(0, 10),
    },
  ];

  for (const lic of licenses) {
    const tenant = tenants.find((t: any) => t.slug === lic.tenantSlug);
    if (!tenant) {
      console.error(`Tenant ${lic.tenantSlug} not found`);
      continue;
    }

    const licenseKey = `SYSPRO-${lic.type.toUpperCase()}-${tenant.slug.toUpperCase()}-${randomUUID().slice(0, 8)}`;

    // Check if license already exists for this tenant
    const existing = await sql`select id from licenses where tenant_id = ${tenant.id}`;
    if (existing.length > 0) {
      // Update existing license
      const result = await sql`
        update licenses set
          type = ${lic.type},
          seats = ${lic.seats},
          status = ${lic.status},
          expiry = ${lic.expiry},
          license_key = ${licenseKey},
          updated_at = now()
        where tenant_id = ${tenant.id}
        returning id, type, seats, status, license_key
      `;
      console.log(`Updated license for ${lic.tenantSlug}:`, result[0]);
    } else {
      // Insert new license
      const result = await sql`
        insert into licenses (tenant_id, license_key, type, seats, status, expiry, created_at)
        values (${tenant.id}, ${licenseKey}, ${lic.type}, ${lic.seats}, ${lic.status}, ${lic.expiry}, now())
        returning id, type, seats, status, license_key
      `;
      console.log(`Created license for ${lic.tenantSlug}:`, result[0]);
    }
  }

  // Verify
  const allLicenses = await sql`
    select l.id, l.type, l.seats, l.status, l.license_key, l.expiry, t.slug as tenant_slug, t.name as tenant_name
    from licenses l
    join tenants t on l.tenant_id = t.id
    order by l.created_at
  `;
  console.log(`\nAll licenses (${allLicenses.length}):`);
  for (const l of allLicenses) {
    console.log(`  ${l.tenant_name} (${l.tenant_slug}) | type=${l.type} | seats=${l.seats} | status=${l.status} | key=${l.license_key} | expiry=${l.expiry}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
