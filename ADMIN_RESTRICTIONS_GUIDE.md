# RBAC Admin Restrictions Setup Guide

## Overview

The Admin Restrictions feature allows tenant administrators to globally restrict access to specific modules for **all users** in their tenant. This is a tenant-wide setting that takes precedence over individual role permissions.

## How It Works

### 1. Access the Restrictions Panel

1. Go to **Admin Control** in the sidebar
2. Look for the **Module Access Restrictions** section at the top
3. You'll see all available modules organized by category

### 2. Restrict a Module

1. Click on any module to toggle it
2. The module will:
   - Turn red to show it's restricted
   - Display a **Lock** icon
   - Show "Restricted" status
3. Changes are tracked with "Unsaved Changes" indicator

### 3. Save Changes

1. Click **Save Restrictions** to apply changes
2. A success message confirms the save
3. All users will immediately lose access to restricted modules:
   - Module disappears from navigation
   - Any direct access attempts are blocked
   - API calls will be denied

### 4. Undo Changes

Click **Discard Changes** to revert any unsaved changes.

## Available Modules

### Operations
- **Sales & CRM** - Customer management and deal tracking
- **People & HR** - Employee data and HR operations
- **Projects** - Project management and tracking
- **Inventory** - Stock and inventory management
- **Procurement** - Vendor management and purchasing

### Finance
- **Finance & Accounting** - GL, AR, AP, and reporting
- **Billing** - Invoicing and payment processing

### Admin
- **IT Support** - Ticket system and tech support
- **Automation & Workflows** - Workflow definitions and automation
- **Integrations** - External system connections
- **Security** - Tenant security controls

### Analytics
- **RevOps** - Revenue operations analytics
- **Analytics** - Business intelligence and insights
- **Reports** - Custom reporting
- **Dashboards** - Interactive dashboards

## Restriction Behavior

### UI Layer
- Restricted modules are removed from sidebar navigation
- Users can't navigate to restricted sections
- "Access Restricted" message shown if they try to access the URL directly

### API Layer
- All API calls for restricted modules return 403 Forbidden
- Features that depend on restricted module APIs won't function
- Client-side checks prevent requests before they're sent

### Admin Override
- **Tenant Admin cannot override restrictions** - they're tenant-wide
- If a module is restricted, no user (including admins) can access it
- This ensures consistent enforcement

## Use Cases

### Phased Rollout
Restrict advanced features until users are trained:
```
1. Restrict "Analytics" and "Integrations"
2. Train users on basic operations
3. Unrestrict "Analytics" when ready
```

### Compliance & Security
Hide sensitive modules from all users:
```
- Restrict "Security" if you prefer external management
- Restrict "APIs/Integrations" to limit external connections
- Restrict specific modules during an audit
```

### Simplification
Reduce feature complexity for small teams:
```
- Restrict "Projects" if you only use CRM
- Restrict "RevOps Analytics" if you rely on Finance only
- Unrestrict as company grows
```

## Implementation Details

### Storage
Restrictions are stored at the tenant level:
```
GET /api/tenant/access-restrictions?tenantSlug=company-name
POST /api/tenant/access-restrictions
  { "tenantSlug": "company-name", "restrictions": [...] }
```

### Data Flow
1. Admin saves restriction in UI
2. POST request sends to `/api/tenant/access-restrictions`
3. Restrictions stored for tenant
4. All users' permission checks now include restrictions
5. Navigation and API access immediately blocked

### Integration with Permissions

Restrictions work alongside role-based permissions:

```typescript
// Users have individual role permissions (read/write/admin)
// PLUS tenant-wide restrictions

// Final access = (role allows) AND NOT (restricted)

// Example:
// User role: can read "finance" ✅
// Tenant restriction: "finance" restricted ❌
// Final result: NO ACCESS ❌
```

## Technical Implementation

### Frontend Hook
```typescript
import { usePermissions } from "@/lib/use-permissions";

// Hook includes restrictions in permission checks
const { canRead, permissions } = usePermissions(tenantSlug);

// These account for both role + restrictions
canRead("finance"); // false if restricted
```

### API Enforcement
```typescript
// API routes can enforce restrictions:
import { createPermissionEnsurer } from "@/lib/api-permissions";

const ensurer = createPermissionEnsurer(permissions);
ensurer.ensureRead("finance"); // throws if restricted
```

## Troubleshooting

### Module still visible after restricting
- Refresh the page (browser cache)
- Check that the save was successful (green success message)
- Verify you're logged in as a tenant admin

### Users can still access via URL
- This means API enforcement hasn't been implemented yet
- The permission model is ready in `api-permissions.ts`
- API routes need to be updated to use enforcement

### I need to restrict a module that's not listed
- Check [RBAC_SYSTEM.md](./RBAC_SYSTEM.md) for all available modules
- If a module is missing, add it to the `AVAILABLE_MODULES` list in `admin-restrictions.tsx`
- Restart the development server

## Next Steps

### Immediate
1. ✅ Use restrictions to hide modules you don't need
2. ✅ Set up role-based permissions for users (see [RBAC_SYSTEM.md](./RBAC_SYSTEM.md))
3. ✅ Test that restricted modules disappear from navigation

### Short Term
- [ ] Add audit logging to track who restricted what modules
- [ ] Create restriction presets for common industry setups
- [ ] Build time-based restrictions (restrict until date X)

### Medium Term
- [ ] Add module sub-restrictions (e.g., restrict only "CRM - Leads")
- [ ] Create approval workflows for restriction changes
- [ ] Build reports showing how many users are affected

## FAQ

**Q: Can users override restrictions if they're admins?**
A: No. Restrictions are tenant-wide and apply to all users including admins.

**Q: What happens if a module is restricted but a user has a bookmark?**
A: Direct access attempts show "Access Restricted" message. API calls are denied.

**Q: Can I restrict just a feature within a module?**
A: Not yet. Current system restricts entire modules. Feature-level restrictions coming soon.

**Q: How do users know why a module is missing?**
A: They'll see "Access Restricted" message if they try to access the URL. Add it to your onboarding docs.

**Q: Can I schedule restrictions (e.g., only available 9-5)?**
A: Not in current version. Time-based restrictions are planned.

---

For complete RBAC system documentation, see [RBAC_SYSTEM.md](./RBAC_SYSTEM.md)
