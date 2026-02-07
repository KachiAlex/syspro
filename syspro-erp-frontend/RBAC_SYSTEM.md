# Role-Based Access Control (RBAC) System

## Overview

The RBAC system controls what features and data users can access within SysproERP. It's based on:
- **Roles**: Job titles with permission sets (e.g., Manager, Finance Officer, HR Admin)
- **Modules**: Feature areas like CRM, Finance, HR, etc.
- **Permissions**: Read, Write, or Admin access levels for each module
- **Scopes**: Tenant-wide, Regional, or Branch-level access

## Modules

All available modules that support RBAC:

```
overview       - Dashboard and main overview
crm            - Sales, leads, customers, opportunities
finance        - Invoices, payments, accounting, budgets
people         - HR, employees, payroll, benefits
projects       - Project management and time tracking
billing        - Billing and subscription management
inventory      - Stock management and transfers
procurement    - Vendor management and purchase orders
itsupport      - IT support tickets and issues
revops         - Revenue operations analytics
automation     - Workflows, approvals, automation rules
admin          - System administration
integrations   - Third-party integrations
analytics      - Business analytics and reports
security       - Security settings and compliance
policies       - Business policies and rules
reports        - Custom report builder
dashboards     - Dashboard customization
```

## Permission Levels

- **none (0)**: No access - module is hidden from user
- **read (1)**: View-only access - user can see data but cannot modify
- **write (2)**: Edit access - user can create and modify records
- **admin (3)**: Full control - user can manage settings, permissions, etc.

## User Permission Structure

```typescript
interface UserPermissions {
  userId: string;                    // Current user ID
  tenantSlug: string;               // Tenant/organization
  role: string;                     // Role name (admin, manager, etc.)
  scope: "tenant" | "region" | "branch";  // Access scope
  modules: Record<string, PermissionLevel>; // Module permissions
  features: string[];               // Feature flags
  restrictions: string[];           // Restricted modules
}
```

## Usage in Components

### Check Permissions in React Components

```tsx
import { usePermissions } from "@/lib/use-permissions";

export function MyComponent() {
  const { canRead, canWrite, canAdmin } = usePermissions(tenantSlug);

  return (
    <>
      {canRead("finance") && <FinanceSection />}
      
      {canWrite("crm") && (
        <button onClick={handleCreate}>Create Lead</button>
      )}
      
      {canAdmin("admin") && <AdminPanel />}
    </>
  );
}
```

### Check Permissions in TypeScript

```tsx
import { canRead, canWrite, canAdmin } from "@/lib/permissions";

const permissions = await getPermissions();

if (canWrite(permissions, "finance")) {
  // Allow creating invoice
}
```

### Filter Navigation Based on Permissions

```tsx
import { filterNavigation } from "@/lib/permissions";

const visibleNav = filterNavigation(NAVIGATION, permissions);
// Returns only navigation items user can access
```

## Usage in API Routes

### Protect API Endpoints

```typescript
// api/finance/invoices/route.ts
import { hasApiPermission } from "@/lib/api-permissions";

export async function POST(request: Request) {
  const permissions = await getUserPermissions();
  
  if (!hasApiPermission(permissions, "finance", "write")) {
    return new Response("Permission denied", { status: 403 });
  }
  
  // Process invoice creation
}
```

### Use Permission Enforcer

```typescript
import { createPermissionEnsurer } from "@/lib/api-permissions";

export async function DELETE(request: Request) {
  const permissions = await getUserPermissions();
  const enforcer = createPermissionEnsurer(permissions);
  
  try {
    enforcer.ensureAdmin("finance");
    // Delete operation
  } catch (error) {
    return new Response("Access denied", { status: 403 });
  }
}
```

## Setting Up User Permissions

### 1. Assign a Role to a User

Navigate to **People & Access** → **Access Control** and assign a role template:
- **Viewer**: Read-only access to most modules
- **Editor**: Can create and edit records
- **Manager**: Full access to department modules
- **Administrator**: Full system access

### 2. Create Custom Roles

In **People & Access** → **Role Builder**:
1. Click "Create Role"
2. Set role name and scope (Tenant-wide, Regional, or Branch)
3. Select permissions for each module
4. Save and assign to users

### 3. Apply Tenant-Wide Restrictions

As a **Tenant Admin**:
1. Go to **Admin Control** → **Restrictions**
2. Select modules to restrict access to
3. Click "Apply Restrictions"
4. Users will no longer see restricted modules

## Permission Hierarchy

1. **User's Assigned Role** → Determines base permission set
2. **Scope** → Limits access by region/branch
3. **Tenant Admin Restrictions** → Can further limit access
4. **Feature Flags** → Unlock beta/premium features

## Default Role Permissions

### Viewer Role
```
crm:         read
finance:     read
people:      read
projects:    read
billing:     read
analytics:   read
[all others]  none
```

### Editor Role
```
crm:         write
finance:     write
people:      write
projects:    write
billing:     write
analytics:   read
[admin mods]  none
```

### Manager Role
```
crm:         admin
finance:     admin
people:      admin
projects:    admin
billing:     admin
analytics:   read
integrations: none
security:    none
```

### Administrator Role
```
[all modules]: admin
```

## Session Integration

The system expects the following session data available via `/api/tenant/user-permissions`:

```typescript
{
  permissions: {
    userId: "user-123",
    tenantSlug: "company-a",
    role: "manager",
    scope: "tenant",
    modules: { ... },
    features: ["feature-1"],
    restrictions: []
  }
}
```

Update `src/app/api/tenant/user-permissions/route.ts` to integrate with your authentication system.

## Implementing Permission Checks

### In Navigation

Naviga items are automatically filtered based on permissions:

```tsx
// main page automatically filters navigation
navigation={NAVIGATION.map(section => ({
  ...section,
  links: section.links.filter(link => canRead(module))
}))}
```

### In Workspace Rendering

Sections check permission before rendering:

```tsx
{activeNav === "finance" && canRead("finance") ? (
  <FinanceWorkspace />
) : !canRead("finance") ? (
  <PermissionDenied />
) : null}
```

### In Data Display

Show/hide features based on permission level:

```tsx
{canWrite("finance") && (
  <CreateInvoiceButton />
)}

{canAdmin("finance") && (
  <ManageSettingsLink />
)}
```

## Audit & Compliance

All permission checks are logged in development console:
- When user tries to access restricted section
- When API permission check fails
- When feature flags are checked

Monitor these logs in production for security compliance.

## Troubleshooting

### "Access Restricted" Message

User doesn't have permission for the section. Solutions:
1. Check user's assigned role in **People & Access** → **Access Control**
2. Check **Admin Control** → **Restrictions** for blocked modules
3. Verify user's scope matches resource location
4. Contact tenant admin to grant access

### Module Not Showing in Navigation

Cause: User lacks read permission. To fix:
1. Tenant admin assigns user to appropriate role
2. Or manually grants module read permission
3. User may need to refresh page/re-login

### API Permission Denied (403)

The API enforces permissions. Ensure:
1. User has write/admin permission for the module
2. User is modifying resources in their scope
3. Feature is not in restrictions list

## Best Practices

1. **Principle of Least Privilege**: Assign minimum permissions needed
2. **Role-Based**: Use roles rather than individual permissions
3. **Audit Trail**: Log who accessed what and when
4. **Regular Review**: Periodically audit user permissions
5. **Separation of Duties**: Don't let one person approve their own requests
6. **Test Scenarios**: Test each role to verify correct access

## Future Enhancements

- [ ] Time-based temporary permissions
- [ ] Resource-level permissions (specific invoice access)
- [ ] Team-based permissions
- [ ] Data classification labels
- [ ] Permission approval workflows
- [ ] Audit log viewer
- [ ] Permission analytics dashboard
