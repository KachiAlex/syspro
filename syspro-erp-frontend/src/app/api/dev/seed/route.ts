import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DEV_DIR = path.join(process.cwd(), "dev-data");
const TENANTS_FILE = path.join(DEV_DIR, "tenants.json");

async function readTenantsFile() {
  try {
    const content = await fs.promises.readFile(TENANTS_FILE, "utf8");
    return JSON.parse(content || "{}");
  } catch (e) {
    return { tenants: [] };
  }
}

export async function GET() {
  const data = await readTenantsFile();
  return NextResponse.json(data);
}

export async function POST() {
  // deterministic seed data for local/dev testing
  const seed = {
    tenants: [
      {
        name: "Acme Inc",
        slug: "acme-inc",
        region: "EMEA",
        status: "Pending",
        ledger: "₦0",
        seats: 10,
        admin_email: "admin@acme.local",
        persisted: true,
      },
      {
        name: "Kreatix Default",
        slug: "kreatix-default",
        region: "Africa",
        status: "Live",
        ledger: "₦0",
        seats: 5,
        admin_email: "dev@local",
        persisted: true,
      },
    ],
  };

  try {
    await fs.promises.mkdir(DEV_DIR, { recursive: true });
    await fs.promises.writeFile(TENANTS_FILE, JSON.stringify(seed, null, 2), "utf8");
    return NextResponse.json(seed, { status: 201 });
  } catch (err) {
    console.error("Dev seed write failed", err);
    return NextResponse.json({ error: "Unable to write dev seed" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await fs.promises.rm(TENANTS_FILE, { force: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to remove dev tenants file", err);
    return NextResponse.json({ error: "Failed to remove file" }, { status: 500 });
  }
}

