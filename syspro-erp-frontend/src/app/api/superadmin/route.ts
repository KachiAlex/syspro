import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, sql as SQL, SqlClient } from "@/lib/sql-client";

const payloadSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  bootstrapKey: z.string().min(1, "Bootstrap key is required"),
});

async function ensureTable(sql: SqlClient) {
  await sql`
    create table if not exists superadmins (
      id uuid primary key,
      name text not null,
      email text not null unique,
      password_hash text not null,
      created_at timestamptz not null default now()
    )
  `;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { name, email, password, bootstrapKey } = parsed.data;
    const expectedKey = process.env.SUPERADMIN_BOOTSTRAP_KEY;

    if (!expectedKey) {
      return NextResponse.json({ error: "SUPERADMIN_BOOTSTRAP_KEY is not configured" }, { status: 500 });
    }

    if (bootstrapKey !== expectedKey) {
      return NextResponse.json({ error: "Invalid bootstrap key" }, { status: 401 });
    }

    const sql = SQL;
    await ensureTable(sql);

    const passwordHash = await bcrypt.hash(password, 12);
    const superadminId = randomUUID();

    await sql`
      insert into superadmins (id, name, email, password_hash)
      values (${superadminId}, ${name}, ${email.toLowerCase()}, ${passwordHash})
      on conflict (email) do update set name = excluded.name, password_hash = excluded.password_hash
    `;

    return NextResponse.json({ id: superadminId, email }, { status: 201 });
  } catch (error) {
    console.error("Superadmin creation failed", error);
    return NextResponse.json({ error: "Unable to create superadmin" }, { status: 500 });
  }
}
