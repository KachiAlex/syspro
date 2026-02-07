# Phase 1: Auth Integration - Implementation Guide

## Overview

Phase 1 of the RBAC Next Phases implements **Auth Integration**: connecting user authentication to real role-based permissions instead of hardcoded admin access for everyone.

**Goal**: Different users get different permissions based on their assigned role.

---

## Architecture

### User Identification Flow

```
Request → getCurrentUser() → SessionUser (with roleId) → getRolePermissionsFromDB() → Computed Permissions
```

### Components

#### 1. Database Schema
**File**: `db/migrations/20260212_create_user_roles_and_permissions.sql`

Tables:
- **tenant_users**: Stores user account info and role assignment
  - Columns: id, tenant_slug, email, name, password_hash, role_id, is_active
  - Indexes: (tenant_slug), (email, tenant_slug), unique (tenant_slug, role_id)
  
- **roles**: Predefined role definitions with module permissions
  - Columns: id (admin/manager/editor/viewer), name, description, permissions (JSONB)
  - Stores: All 20+ modules with permission levels (0=none, 1=read, 2=write, 3=admin)
  
- **role_history**: Audit trail for role assignments
  - Columns: id, tenant_user_id, role_id, assigned_at, assigned_by
  - Tracks when roles were assigned and by whom

#### 2. Auth Helpers Library
**File**: `src/lib/auth-helpers.ts`

Provides utility functions for all API routes:

```typescript
// Identify current user
getCurrentUser(request: NextRequest): SessionUser | null
// Returns: { id, email, name, tenantSlug, roleId }
// Sources: X-User-* headers (dev) → demo user (fallback)

// Validate tenant access
validateTenantAccess(user: SessionUser, tenantSlug: string): boolean
// Ensures user belongs to requested tenant

// Fetch role permissions from database
getRolePermissionsFromDB(roleId: string): Record<string, PermissionLevel>
// Returns: { crm: "admin", finance: "read", ... }
// Falls back to default role definitions if DB unavailable

// Get feature access by role
getFeatureFlags(roleId: string): string[]
// Returns: feature names user can access (admin gets all, viewer gets fewer)
```

#### 3. Updated Permissions Endpoint
**File**: `src/app/api/tenant/user-permissions/route.ts`

Computes permissions dynamically:

```typescript
export async function GET(request: NextRequest) {
  // Step 1: Get current user
  const user = getCurrentUser(request); // SessionUser { id, email, tenantSlug, roleId }
  
  // Step 2: Validate tenant access
  validateTenantAccess(user, tenantSlug); // 403 if mismatch
  
  // Step 3: Fetch role permissions from DB
  const rolePermissions = getRolePermissionsFromDB(user.roleId);
  
  // Step 4: Build permissions object
  return { 
    permissions: {
      userId: user.id,
      role: user.roleId,
      tenantSlug,
      modules: rolePermissions, // e.g., { crm: "write", finance: "read" }
      features: getFeatureFlags(user.roleId)
    }
  };
}
```

---

## Default Roles

| Role | Overview | CRM | Finance | HR | Inventory | Admin |
|------|----------|-----|---------|----|-----------| ------|
| **admin** | admin | admin | admin | admin | admin | admin |
| **manager** | write | write | read | write | read | none |
| **editor** | write | write | read | write | read | none |
| **viewer** | read | read | none | read | read | none |

- **admin** (3): Full read/write/delete on all modules
- **write** (2): Can create/edit records
- **read** (1): Can view records only
- **none** (0): No access

---

## Development Usage

### Testing with Headers

For development/testing without full authentication setup, use request headers to simulate different users:

```bash
# Test as admin
curl -H "X-User-Id: admin-123" \
     -H "X-User-Email: admin@example.com" \
     -H "X-Tenant-Slug: kreatix-default" \
     -H "X-Role-Id: admin" \
     http://localhost:3000/api/tenant/user-permissions?tenantSlug=kreatix-default

# Test as manager
curl -H "X-User-Id: mgr-456" \
     -H "X-User-Email: manager@example.com" \
     -H "X-Tenant-Slug: kreatix-default" \
     -H "X-Role-Id: manager" \
     http://localhost:3000/api/tenant/user-permissions?tenantSlug=kreatix-default

# Test as viewer
curl -H "X-User-Id: view-789" \
     -H "X-User-Email: viewer@example.com" \
     -H "X-Tenant-Slug: kreatix-default" \
     -H "X-Role-Id: viewer" \
     http://localhost:3000/api/tenant/user-permissions?tenantSlug=kreatix-default
```

### Running Test Script

```bash
# Run auth integration tests
node scripts/test-auth-integration.mjs
```

Output shows permissions for each role:
```
Testing as admin...
✅ Status: 200
   Role: admin
   Module Access:
     - CRM: admin
     - Finance: admin
     - Admin: admin
   Features: all

Testing as manager...
✅ Status: 200
   Role: manager
   Module Access:
     - CRM: write
     - Finance: read
     - Admin: none
   Features: reports, advanced_analytics, custom_reports
```

---

## Production Usage

### Session Integration (Next Step)

Replace the fallback behavior in `getCurrentUser()`:

```typescript
export async function getCurrentUser(request: NextRequest): SessionUser {
  // Option 1: NextAuth.js
  const session = await getServerSession();
  
  // Option 2: Clerk
  const userId = auth().userId;
  
  // Option 3: Custom JWT from cookies
  const token = parseCookie(request.headers.get('cookie'));
  
  // Query database for user details
  const user = await db.query(
    'SELECT id, email, name, tenant_slug, role_id FROM tenant_users WHERE id = $1',
    [userId]
  );
  
  return { ...user };
}
```

### Database Query Implementation

Replace placeholder comments:

```typescript
// In getRolePermissionsFromDB():
export async function getRolePermissionsFromDB(roleId: string) {
  try {
    const result = await db.query(
      'SELECT permissions FROM roles WHERE id = $1',
      [roleId]
    );
    
    if (result.rows.length === 0) {
      return getDefaultRolePermissions(roleId);
    }
    
    // Convert numeric permissions (0-3) to strings ("none"-"admin")
    const perms = result.rows[0].permissions;
    return Object.entries(perms).reduce((acc, [key, level]) => ({
      ...acc,
      [key]: getPermissionLevelString(level)
    }), {});
  } catch (error) {
    console.error('DB error fetching role permissions:', error);
    return getDefaultRolePermissions(roleId);
  }
}
```

---

## Type Safety

Permission levels are **strings** (not numbers):

```typescript
type PermissionLevel = "none" | "read" | "write" | "admin";

// ✅ Correct
const perms: Record<string, PermissionLevel> = {
  crm: "admin",
  finance: "read",
  hr: "write",
  inventory: "none"
};

// ❌ Incorrect (numbers not allowed)
const badPerms = {
  crm: 3,  // Should be "admin"
  finance: 1,  // Should be "read"
};
```

Database stores numeric values (0-3) for efficiency, but API layer converts to strings before returning.

---

## API Response Format

**Endpoint**: `GET /api/tenant/user-permissions?tenantSlug={tenantSlug}`

**Success (200)**:
```json
{
  "permissions": {
    "userId": "user-123",
    "role": "manager",
    "tenantSlug": "acme-corp",
    "modules": {
      "crm": "write",
      "finance": "read",
      "hr": "write",
      "inventory": "read",
      "accounting": "none",
      "admin": "none",
      "...": "..."
    },
    "features": ["reports", "advanced_analytics", "custom_reports"]
  }
}
```

**Error - No User (401)**:
```json
{ "error": "Unauthorized" }
```

**Error - Tenant Mismatch (403)**:
```json
{ "error": "Forbidden" }
```

---

## Testing Checklist

- [ ] Run database migration: `npm run migrate`
- [ ] Test admin user gets all permissions
- [ ] Test manager user gets write on CRM, read on Finance
- [ ] Test editor user gets same as manager
- [ ] Test viewer user gets read-only access
- [ ] Test feature flags (admin gets all, manager gets reports+analytics, viewer gets reports)
- [ ] Test tenant isolation (manager can't see other tenant's data)
- [ ] Test missing tenant slug returns 400
- [ ] Test invalid tenant slug returns 403

---

## Remaining Phases (After Phase 1)

### Phase 2: Role Assignment UI
- [ ] Admin panel in People & Access section
- [ ] UI to assign users to roles
- [ ] Save assignments to `tenant_users.role_id`
- [ ] View audit log from `role_history` table

### Phase 3: API Endpoint Protection
- [ ] Apply permission checks to other routes
- [ ] Use `createPermissionEnsurer()` from api-permissions.ts
- [ ] Enforce write/admin permission checks before POST/PUT/DELETE
- [ ] Return 403 for permission denied

### Phase 4: Action Button Gating
- [ ] Hide Create button if `canWrite` is false
- [ ] Hide Edit/Delete buttons if `canAdmin` or `canWrite` is false
- [ ] Disable buttons visually but also check server-side

---

## Troubleshooting

**Q: Headers not working?**
- Ensure request includes ALL headers: X-User-Id, X-User-Email, X-Tenant-Slug, X-Role-Id
- Check Content-Type header is correct
- Use curl or Postman instead of browser (browser can't set custom headers)

**Q: Getting 403 Forbidden?**
- Check tenant slug matches X-Tenant-Slug header
- Check user's role exists in database
- Verify database migration was run

**Q: Permissions show as "none" for everything?**
- Check `X-Role-Id` header value matches role in database
- Check database has default roles seeded (admin/manager/editor/viewer)
- Check `getDefaultRolePermissions()` fallback is working

**Q: Type error on PermissionLevel?**
- Ensure all values are strings: "admin", "write", "read", "none" (not 3, 2, 1, 0)
- Check database values are converted with `getPermissionLevelString()`
- Verify TypeScript compilation: `npm run build`

---

## Files Changed

- **New**: `db/migrations/20260212_create_user_roles_and_permissions.sql`
- **New**: `src/lib/auth-helpers.ts`
- **New**: `scripts/test-auth-integration.mjs`
- **Modified**: `src/app/api/tenant/user-permissions/route.ts`
