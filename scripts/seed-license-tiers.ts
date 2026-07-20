import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(connectionString);

async function main() {
  // Create license_tiers table
  await sql`
    CREATE TABLE IF NOT EXISTS license_tiers (
      id SERIAL PRIMARY KEY,
      key VARCHAR(50) UNIQUE NOT NULL,
      label VARCHAR(100) NOT NULL,
      description TEXT,
      min_seats INTEGER NOT NULL DEFAULT 1,
      max_seats INTEGER NOT NULL DEFAULT 100000,
      default_seats INTEGER NOT NULL DEFAULT 1,
      price_per_seat DECIMAL(10,2) NOT NULL DEFAULT 0,
      currency VARCHAR(3) NOT NULL DEFAULT 'USD',
      billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
      features JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP
    )
  `;
  console.log("Created license_tiers table");

  // Seed default tiers
  const tiers = [
    {
      key: "starter",
      label: "Starter",
      description: "Small businesses (1-10 employees). Core HR, basic payroll, employee portal.",
      min_seats: 5,
      max_seats: 25,
      default_seats: 10,
      price_per_seat: 29,
      currency: "USD",
      billing_cycle: "monthly",
      features: ["Core HR", "Basic Payroll", "Employee Portal", "Basic Reports"],
      sort_order: 1,
    },
    {
      key: "growth",
      label: "Growth",
      description: "Mid-market (10-100 employees). Recruitment, leave management, performance, CRM.",
      min_seats: 25,
      max_seats: 100,
      default_seats: 50,
      price_per_seat: 49,
      currency: "USD",
      billing_cycle: "monthly",
      features: ["Everything in Starter", "Recruitment", "Leave Management", "Performance Reviews", "CRM", "Advanced Reports"],
      sort_order: 2,
    },
    {
      key: "professional",
      label: "Professional",
      description: "Large organizations (100-500 employees). Finance, inventory, automation, analytics.",
      min_seats: 100,
      max_seats: 500,
      default_seats: 200,
      price_per_seat: 79,
      currency: "USD",
      billing_cycle: "monthly",
      features: ["Everything in Growth", "Finance Module", "Inventory Management", "Workflow Automation", "Analytics Dashboard", "API Access"],
      sort_order: 3,
    },
    {
      key: "enterprise",
      label: "Enterprise",
      description: "Corporations (500+ employees). Multi-region, custom integrations, SLA, audit logs.",
      min_seats: 500,
      max_seats: 100000,
      default_seats: 1000,
      price_per_seat: 0,
      currency: "USD",
      billing_cycle: "custom",
      features: ["Everything in Professional", "Multi-Region Support", "Custom Integrations", "SLA Guarantee", "Audit Logs", "Dedicated Support", "White-label Branding", "Unlimited Storage"],
      sort_order: 4,
    },
  ];

  for (const tier of tiers) {
    const featuresJson = JSON.stringify(tier.features);
    await sql`
      INSERT INTO license_tiers (key, label, description, min_seats, max_seats, default_seats, price_per_seat, currency, billing_cycle, features, is_active, sort_order)
      VALUES (${tier.key}, ${tier.label}, ${tier.description}, ${tier.min_seats}, ${tier.max_seats}, ${tier.default_seats}, ${tier.price_per_seat}, ${tier.currency}, ${tier.billing_cycle}, ${featuresJson}::jsonb, true, ${tier.sort_order})
      ON CONFLICT (key) DO UPDATE SET
        label = EXCLUDED.label,
        description = EXCLUDED.description,
        min_seats = EXCLUDED.min_seats,
        max_seats = EXCLUDED.max_seats,
        default_seats = EXCLUDED.default_seats,
        price_per_seat = EXCLUDED.price_per_seat,
        currency = EXCLUDED.currency,
        billing_cycle = EXCLUDED.billing_cycle,
        features = EXCLUDED.features,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    `;
    console.log(`  Seeded tier: ${tier.key}`);
  }

  // Verify
  const rows = await sql`select * from license_tiers order by sort_order`;
  console.log(`\nLicense tiers (${rows.length}):`);
  for (const r of rows) {
    console.log(`  ${r.key} | ${r.label} | seats ${r.min_seats}-${r.max_seats} | $${r.price_per_seat}/${r.billing_cycle} | features: ${r.features?.length || 0}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
