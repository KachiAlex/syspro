# RBAC Quick Reference Guide

**Last Updated**: February 7, 2026  
**Status**: Phase 1 & 2 Complete - Ready for Phase 3

---

## Quick Facts

- **4 Roles**: administrator, manager, editor, viewer
- **Permission Levels**: "none" | "read" | "write" | "admin"
- **Multi-tenant**: Each user belongs to one tenant
- **Audit Trail**: All role changes tracked in role_history table
- **Dev Headers**: Use X-User-* headers for testing without auth

---

## Getting User Permissions

### Pattern 1: In API Routes

```typescript
import { getCurrentUser, getRolePermissionsFromDB } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  // 1. Get current user
  const user = getCurrentUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Get their role permissions
  const permissions = getRolePermissionsFromDB(user.roleId);
  
  // 3. Check permission for action
  if (permissions.crm !== "write" && permissions.crm !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4. Proceed with operation
  // ... rest of API logic
}
```

### Pattern 2: In Components

```typescript
import { usePermissions } from "@/lib/use-permissions";

export function CrmModule() {
  const permissions = usePermissions();
  const canWrite = permissions.modules?.crm === "write" || 
                   permissions.modules?.crm === "admin";

  return (
    <>
      {canWrite && <CreateButton onClick={handleCreate} />}
      <ListComponent />
    </>
  );
}
```

---

## Permission Hierarchy

```
admin  (3) → Highest - Create, read, update, delete, admin actions
write  (2) → Middle  - Create, read, update
read   (1) → Lower   - View only
none   (0) → Lowest  - No access

Numeric mapping (database):
3 = "admin"
2 = "write"
1 = "read"
0 = "none"
```

### Module Permission Reference

| Module | Admin | Manager | Editor | Viewer |
|--------|-------|---------|--------|--------|
| overview | admin | read | read | read |
| crm | admin | write | write | read |
| finance | admin | read | read | read |
| people | admin | write | read | read |
| projects | admin | write | write | read |
| billing | admin | read | read | read |
| inventory | admin | read | read | read |
| procurement | admin | read | read | read |
| itsupport | admin | read | read | read |
| revops | admin | read | read | read |
| automation | admin | read | read | none |
| admin | admin | read | none | none |
| integrations | admin | read | none | none |
| analytics | admin | read | read | read |
| security | admin | read | none | none |
| policies | admin | read | none | none |
| reports | admin | read | read | read |
| dashboards | admin | read | read | read |
| approvals | admin | write | read | none |
| workflows | admin | write | read | none |

---

## Development Testing

### Using Headers

```bash
# Test as manager
curl http://localhost:3000/api/tenant/user-permissions?tenantSlug=kreatix-default \
  -H "X-User-Id: user-123" \
  -H "X-User-Email: manager@example.com" \
  -H "X-Tenant-Slug: kreatix-default" \
  -H "X-Role-Id: manager"

# Test as viewer
curl http://localhost:3000/api/tenant/user-permissions?tenantSlug=kreatix-default \
  -H "X-User-Id: user-456" \
  -H "X-User-Email: viewer@example.com" \
  -H "X-Tenant-Slug: kreatix-default" \
  -H "X-Role-Id: viewer"
```

### In Browser

Navigate to: **Tenant Admin** → **People & Access**

See all available options in the role assignment panel:
- View users by role
- Assign roles to users
- View audit log

---

## Key Functions

### `getCurrentUser(request: NextRequest)`

**Returns**: `SessionUser | null`

```typescript
const user = getCurrentUser(request);
// {
//   id: "user-123",
//   email: "john@example.com",
//   name: "John Smith",
//   tenantSlug: "kreatix-default",
//   roleId: "manager"
// }
```

### `getRolePermissionsFromDB(roleId: string)`

**Returns**: `Record<string, PermissionLevel>`

```typescript
const perms = getRolePermissionsFromDB("manager");
// {
//   crm: "write",
//   finance: "read",
//   people: "write",
//   admin: "read",
//   ...
// }
```

### `validateTenantAccess(user: SessionUser, tenantSlug: string)`

**Returns**: `boolean` - Throws if mismatch

```typescript
validateTenantAccess(user, "kreatix-default"); // true
validateTenantAccess(user, "other-tenant");    // throws error
```

### `getFeatureFlags(roleId: string)`

**Returns**: `string[]` - Features user can access

```typescript
getFeatureFlags("admin");   // ["all"]
getFeatureFlags("manager"); // ["reports", "advanced_analytics", "custom_reports"]
getFeatureFlags("viewer");  // ["reports"]
```

---

## File Locations

### Core Auth Helpers
`src/lib/auth-helpers.ts` - 6 utility functions

### API Endpoints
```
src/app/api/tenant/
  ├── user-permissions/route.ts     -- GET permissions
  ├── users/route.ts                -- GET list users
  ├── users/assign-role/route.ts    -- POST assign role
  └── role-history/route.ts         -- GET audit log
```

### UI Components
```
src/app/tenant-admin/sections/
  ├── role-assignment.tsx           -- Role assignment UI (NEW)
  ├── access-control.tsx            -- Module restrictions
  └── role-builder.tsx              -- Role definitions
```

### Tests
`scripts/test-auth-integration.mjs` - Tests all roles

---

## Common Tasks

### Check if User Can Create

```typescript
const canCreate = (perms: Record<string, PermissionLevel>, module: string) => {
  const level = perms[module];
  return level === "write" || level === "admin";
};

if (canCreate(permissions, "crm")) {
  // Show create button
}
```

### Check if User Can Delete

```typescript
const canDelete = (perms: Record<string, PermissionLevel>, module: string) => {
  return perms[module] === "admin";
};

if (canDelete(permissions, "crm")) {
  // Show delete button
}
```

### Check if User Can View

```typescript
const canView = (perms: Record<string, PermissionLevel>, module: string) => {
  const level = perms[module];
  return level !== "none";
};

if (!canView(permissions, "admin")) {
  return <AccessDenied />;
}
```

### Assign Role (Admin Only)

```typescript
// In component
const handleAssignRole = async (userId: string, newRoleId: string) => {
  const response = await fetch("/api/tenant/users/assign-role", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      newRoleId,
      tenantSlug: tenantSlug,
    }),
  });

  if (response.ok) {
    // Success - refresh user list
    await fetchUsers();
  }
};
```

---

## Adding Permission Checks to New Routes

### Template for Protected GET

```typescript
import { getCurrentUser, getRolePermissionsFromDB, validateTenantAccess } from "@/lib/auth-helpers";

export async function GET(request: NextRequest, { params }: { params: { tenantSlug: string } }) {
  const user = getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  validateTenantAccess(user, params.tenantSlug);

  const permissions = getRolePermissionsFromDB(user.roleId);
  if (permissions.crm === "none") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Your GET logic here
  return NextResponse.json({ data: results });
}
```

### Template for Protected POST (Write)

```typescript
export async function POST(request: NextRequest, { params }: { params: { tenantSlug: string } }) {
  const user = getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  validateTenantAccess(user, params.tenantSlug);

  const permissions = getRolePermissionsFromDB(user.roleId);
  if (permissions.crm !== "write" && permissions.crm !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Your POST logic here
  return NextResponse.json({ success: true });
}
```

### Template for Protected DELETE (Admin)

```typescript
export async function DELETE(request: NextRequest, { params }: { params: { tenantSlug: string } }) {
  const user = getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  validateTenantAccess(user, params.tenantSlug);

  const permissions = getRolePermissionsFromDB(user.roleId);
  if (permissions.crm !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Your DELETE logic here
  return NextResponse.json({ success: true });
}
```

---

## Troubleshooting

### Permissions Always Return "none"

**Cause**: Database not connected, using default fallback

**Fix**: 
1. Check `getRolePermissionsFromDB` is querying database
2. Verify `roles` table is populated
3. Check role_id is valid (admin|manager|editor|viewer)

### Role Assignment Not Persisting

**Cause**: Mock API doesn't save to database

**Fix**: Replace mock endpoint with real database transaction

### Can't Assign Roles

**Cause**: Not logged in as admin / lack permission

**Fix**:
1. Check `canAdmin("people")` returns true
2. Use X-Role-Id: admin header in dev
3. Verify user has admin role in database

### Audit Log Not Showing

**Cause**: History endpoint not querying database

**Fix**:
1. Replace mock query with real SELECT
2. Verify `role_history` table has entries
3. Filter by correct tenant_slug

---

## TypeScript Types

```typescript
// User identity
type SessionUser = {
  id: string;
  email: string;
  name?: string;
  tenantSlug: string;
  roleId: string;
};

// Permission level
type PermissionLevel = "none" | "read" | "write" | "admin";

// Full permissions object
type UserPermissions = {
  userId: string;
  role: string;
  tenantSlug: string;
  modules: Record<string, PermissionLevel>;
  features: string[];
};

// Role assignment
type RoleAssignment = {
  userId: string;
  oldRoleId?: string;
  newRoleId: string;
  tenantSlug: string;
};

// Audit log entry
type RoleHistoryEntry = {
  id: string;
  userId: string;
  userEmail: string;
  oldRoleId: string | null;
  newRoleId: string;
  assignedAt: string;
  assignedByUserId: string | null;
  assignedByEmail: string | null;
};
```

---

## Next Steps

### Phase 3: API Endpoint Protection
Add permission checks to:
- CRM routes
- Finance routes
- People/HR routes
- Projects routes
- All other module endpoints

### Phase 4: Action Button Gating
Hide/disable buttons based on:
- Create: requires write or admin
- Edit: requires write or admin
- Delete: requires admin only

---

**Questions?** Check the full documentation:
- [Phase 1: Auth Integration](AUTH_INTEGRATION_PHASE1.md)
- [Phase 2: Role Assignment UI](PHASE2_ROLE_ASSIGNMENT_GUIDE.md)
- [Implementation Progress](RBAC_IMPLEMENTATION_PROGRESS.md)

