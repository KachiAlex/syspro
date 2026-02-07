# Auth Integration Guide - RBAC System

## Current State

The `/api/tenant/user-permissions` endpoint currently returns **hardcoded admin permissions** for all users. This guide shows how to integrate it with your actual authentication system.

## Current Implementation

```typescript
// src/app/api/tenant/user-permissions/route.ts

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug");

  // ❌ CURRENT: Returns hardcoded admin permissions
  return NextResponse.json({
    permissions: createAdminPermissions(userId, tenantSlug),
  });

  // ⬇️ NEEDS: Get actual permissions from database
}
```

## Integration Steps

### Step 1: Get Current User from Session

Choose your authentication provider:

#### Option A: NextAuth.js v5 (Recommended)
```typescript
import { auth } from "@/auth"; // your NextAuth config

export async function GET(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const userId = session.user.id;
  const userEmail = session.user.email;
  // ... proceed with database lookup
}
```

#### Option B: Clerk
```typescript
import { auth } from "@clerk/nextjs";

export async function GET(request: NextRequest) {
  const { userId } = auth();
  
  if (!userId) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  // ... proceed with database lookup
}
```

#### Option C: Custom Auth
```typescript
export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.split(" ")[1];
  
  const userId = await verifyToken(token);
  if (!userId) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  // ... proceed with database lookup
}
```

### Step 2: Look Up User's Role Assignment

Assuming you have a database with this structure:

```sql
-- Role assignments table
TABLE tenant_user_roles {
  id UUID PRIMARY KEY
  tenant_slug VARCHAR(255)
  user_id VARCHAR(255)
  role_id VARCHAR(100)  -- "admin", "manager", "editor", "viewer"
  assigned_at TIMESTAMP
  assigned_by_user_id VARCHAR(255)
  restrictions TEXT[]    -- ["finance", "itsupport"] - additional user-specific restrictions
}

-- Roles definition
TABLE roles {
  id VARCHAR(100) PRIMARY KEY
  name VARCHAR(255)
  description TEXT
  permissions JSONB  -- { modules: { crm: 1, finance: 2, ... } }
}
```

```typescript
import { db } from "@/db"; // your database client

export async function GET(request: NextRequest) {
  const session = await auth();
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug");

  if (!session?.user || !tenantSlug) {
    return NextResponse.json(
      { error: "Missing required parameters" },
      { status: 400 }
    );
  }

  const userId = session.user.id;

  // Look up user's role assignment for this tenant
  const role = await db.tenantUserRoles.findFirst({
    where: {
      tenantSlug,
      userId,
    },
    include: {
      role: true, // Include role details
    },
  });

  if (!role) {
    // User not in tenant - return minimal permissions
    return NextResponse.json({
      permissions: createDefaultPermissions(userId, tenantSlug),
    });
  }

  // ... continue to Step 3
}
```

### Step 3: Build Permissions from Role

```typescript
import { applyRestrictions, mergePermissions } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  // ... previous steps ...

  // Get role definition
  const roleDefinition = role.role; // { modules: { crm: 1, finance: 2, ... } }

  // Create base permissions from role
  const basePermissions = {
    userId,
    tenantSlug,
    role: role.roleId,
    scope: "tenant", // could be "region", "branch", etc.
    modules: roleDefinition.permissions.modules,
    features: roleDefinition.permissions.features || [],
    restrictions: role.restrictions || [],
  };

  return NextResponse.json({
    permissions: basePermissions,
  });
}
```

### Step 4: Apply Tenant Restrictions

Restrictions are tenant-wide and override role permissions:

```typescript
import { hasPermission, applyRestrictions } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  // ... previous steps - get role and base permissions ...

  // Get tenant-wide restrictions from admin control
  const tenantRestrictions = await db.accessRestrictions.findUnique({
    where: { tenantSlug },
    select: { restrictions: true },
  });

  // Apply restrictions to user permissions
  const finalPermissions = applyRestrictions(
    basePermissions,
    tenantRestrictions?.restrictions || []
  );

  return NextResponse.json({
    permissions: finalPermissions,
  });
}
```

## Complete Implementation Example

```typescript
// src/app/api/tenant/user-permissions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth"; // Your auth provider
import { db } from "@/db"; // Your database
import { 
  createDefaultPermissions, 
  applyRestrictions 
} from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    // Step 1: Get current user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Step 2: Get tenant from query
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get("tenantSlug");
    
    if (!tenantSlug) {
      return NextResponse.json(
        { error: "tenantSlug is required" },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // Step 3: Check if user belongs to tenant
    const tenantMembership = await db.tenantMembers.findFirst({
      where: {
        tenantSlug,
        userId,
      },
    });

    if (!tenantMembership) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Step 4: Look up user's role assignment
    const roleAssignment = await db.tenantUserRoles.findFirst({
      where: {
        tenantSlug,
        userId,
      },
      include: {
        role: {
          select: {
            permissions: true, // JSONB with modules object
          },
        },
      },
    });

    // Step 5: Build permissions
    const permissions = roleAssignment
      ? {
          userId,
          tenantSlug,
          role: roleAssignment.roleId,
          scope: "tenant",
          modules: roleAssignment.role.permissions.modules,
          features: roleAssignment.role.permissions.features || [],
          restrictions: roleAssignment.restrictions || [],
        }
      : createDefaultPermissions(userId, tenantSlug);

    // Step 6: Apply tenant-wide restrictions
    const tenantRestrictions = await db.accessRestrictions.findUnique({
      where: { tenantSlug },
      select: { restrictions: true },
    });

    const finalPermissions = applyRestrictions(
      permissions,
      tenantRestrictions?.restrictions || []
    );

    return NextResponse.json({
      permissions: finalPermissions,
    });

  } catch (error) {
    console.error("Failed to fetch permissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch permissions" },
      { status: 500 }
    );
  }
}
```

## Database Schema Examples

### Prisma Schema

```prisma
model TenantUserRole {
  id String @id @default(cuid())
  tenantSlug String
  userId String
  roleId String
  role Role @relation(fields: [roleId], references: [id])
  restrictions String[] @default([])
  assignedAt DateTime @default(now())
  assignedBy String
  
  @@unique([tenantSlug, userId])
  @@index([tenantSlug])
}

model Role {
  id String @id
  name String
  description String?
  permissions Json // { modules: { crm: 1, finance: 2 }, features: [...] }
  tenantUserRoles TenantUserRole[]
}

model AccessRestriction {
  tenantSlug String @id @unique
  restrictions String[] @default([])
  updatedAt DateTime @updatedAt
}
```

### SQL Schema

```sql
CREATE TABLE tenant_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  role_id VARCHAR(100) NOT NULL,
  restrictions TEXT[] DEFAULT '{}',
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by_user_id VARCHAR(255),
  UNIQUE(tenant_slug, user_id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE roles (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}'
);

CREATE TABLE access_restrictions (
  tenant_slug VARCHAR(255) PRIMARY KEY UNIQUE,
  restrictions TEXT[] DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tenant_user_roles_tenant 
  ON tenant_user_roles(tenant_slug);
```

## Testing the Integration

### Test 1: Verify User Authentication
```bash
# Should return user ID
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/tenant/user-permissions?tenantSlug=test-tenant

# Expected response:
# { "permissions": { "userId": "user123", "role": "admin", ... } }
```

### Test 2: Test Different Roles
```typescript
// Create test users with different roles in database
// admin role, manager role, editor role, viewer role

// Verify each gets appropriate permissions
const adminPerms = await fetchUserPermissions("admin-user", "test-tenant");
const viewerPerms = await fetchUserPermissions("viewer-user", "test-tenant");

// admin should have more permissions than viewer
expect(adminPerms.modules.finance).toBe(3); // admin
expect(viewerPerms.modules.finance).toBe(1); // read
```

### Test 3: Test Restrictions
```typescript
// Add finance to restrictions
await saveRestrictions("test-tenant", ["finance"]);

// Verify user can't access finance even with role permission
const perms = await fetchUserPermissions("user", "test-tenant");
expect(perms.restrictions).toContain("finance");
expect(hasPermission(perms, "finance", "read")).toBe(false);
```

## Troubleshooting

### Issue: All users still get admin permissions
**Cause**: Endpoint not updated
**Fix**: Check that `auth()` is returning a valid session, role lookup is finding records

### Issue: User ID is undefined
**Cause**: Session structure different in your auth provider
**Fix**: Check `session.user` structure - might be `.sub`, `.id`, or `.userId` depending on provider

### Issue: Database connection failing
**Cause**: Missing environment variables
**Fix**: Ensure `DATABASE_URL` is set and connection string is correct

### Issue: Permissions not updating after changing role
**Cause**: Hook caching or frontend not refreshing
**Fix**: Call `refresh()` on the usePermissions hook, or hard refresh page

## Migration Path

If you have existing users without role assignments:

```typescript
// Create a migration function
async function migrateExistingUsers(tenantSlug: string) {
  // Option 1: Assign everyone to "viewer" role
  const users = await db.tenantMembers.findMany({
    where: { tenantSlug },
  });

  for (const user of users) {
    await db.tenantUserRoles.upsert({
      where: {
        tenantSlug_userId: {
          tenantSlug,
          userId: user.userId,
        },
      },
      create: {
        tenantSlug,
        userId: user.userId,
        roleId: "viewer", // default role
      },
      update: {}, // don't update if exists
    });
  }

  console.log(`Migrated ${users.length} users to viewer role`);
}

// Call on app startup or as manual migration
await migrateExistingUsers("kreatix-default");
```

## Default Role Definitions

```typescript
// For database seeding
const DEFAULT_ROLES = {
  admin: {
    id: "admin",
    name: "Administrator",
    permissions: {
      modules: {
        crm: 3, finance: 3, people: 3, projects: 3,
        billing: 3, inventory: 3, procurement: 3,
        itsupport: 3, revops: 3, automation: 3,
        integrations: 3, analytics: 3, security: 3,
        policies: 3, reports: 3, dashboards: 3,
      },
      features: ["all"],
    },
  },
  manager: {
    id: "manager",
    name: "Manager",
    permissions: {
      modules: {
        crm: 2, finance: 1, people: 2, projects: 2,
        billing: 1, inventory: 1, procurement: 1,
        revops: 1, analytics: 1, reports: 1,
        dashboards: 1,
      },
    },
  },
  editor: {
    id: "editor",
    name: "Editor",
    permissions: {
      modules: {
        crm: 2, finance: 1, projects: 2,
        reports: 1, dashboards: 1,
      },
    },
  },
  viewer: {
    id: "viewer",
    name: "Viewer",
    permissions: {
      modules: {
        crm: 1, finance: 1, projects: 1,
        reports: 1, dashboards: 1,
      },
    },
  },
};

// Seed into database
for (const role of Object.values(DEFAULT_ROLES)) {
  await db.roles.upsert({
    where: { id: role.id },
    create: role,
    update: role,
  });
}
```

## Next Steps

1. ✅ Choose your authentication provider
2. ✅ Update `/api/tenant/user-permissions` following the example above
3. ✅ Create role definitions in your database
4. ✅ Test with curl to verify endpoint works
5. ✅ Build role assignment UI in "People & Access"
6. ✅ Update API routes to use permission enforcement
7. ✅ Add audit logging for permission changes

---

For complete RBAC documentation, see [RBAC_SYSTEM.md](./RBAC_SYSTEM.md)
