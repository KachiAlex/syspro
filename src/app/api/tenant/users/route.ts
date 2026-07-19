/**
 * API route to fetch all users in a tenant
 * GET /api/tenant/users?tenantSlug=...
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql } from "@/lib/sql-client";

export async function GET(request: NextRequest) {
  const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");

  if (!tenantSlug) {
    return NextResponse.json(
      { error: "tenantSlug is required" },
      { status: 400 }
    );
  }

  try {
    const rows = await sql`
      SELECT u.id, u.email, u.name, u.status, u.created_at, r.name as role_name
      FROM users u
      JOIN tenants t ON u.tenant_id = t.id
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE t.slug = ${tenantSlug}
      ORDER BY u.created_at DESC
    `;

    const users = Array.isArray(rows) ? rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      roleId: row.role_name || "viewer",
      isActive: row.status === "active",
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    })) : [];

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Failed to fetch tenant users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");

  if (!tenantSlug) {
    return NextResponse.json(
      { error: "tenantSlug is required" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { email, name, status = "active", role } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: "Email and name are required" },
        { status: 400 }
      );
    }

    const userId = randomUUID();
    await sql`
      INSERT INTO users (id, tenant_id, email, name, status, created_at)
      SELECT ${userId}, t.id, ${email}, ${name}, ${status}, now()
      FROM tenants t
      WHERE t.slug = ${tenantSlug}
    `;

    if (role) {
      await sql`
        INSERT INTO user_roles (user_id, role_id)
        SELECT ${userId}, r.id
        FROM roles r
        WHERE r.name = ${role}
        LIMIT 1
      `;
    }

    return NextResponse.json({
      success: true,
      user: { id: userId, email, name, status },
    });
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
