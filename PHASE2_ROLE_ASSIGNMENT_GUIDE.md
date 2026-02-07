# Phase 2: Role Assignment UI - Implementation Overview

## What Was Implemented

Phase 2 adds a **user-facing interface for assigning users to roles**, completing the role-based access control foundation. Admins can now:

1. **Select users** and assign them to predefined roles (admin, manager, editor, viewer)
2. **View all users** organized by role
3. **Track role changes** via an audit log
4. **Manage role assignments** through an intuitive UI

## Architecture

### New Components & Routes

#### 1. Role Assignment Panel UI
**File**: `src/app/tenant-admin/sections/role-assignment.tsx` (290 lines)

Main component for the admin interface:

```typescript
<RoleAssignmentPanel tenantSlug={tenantSlug} />
```

Features:
- **User Selection Dropdown**: Lists all active users with their current role
- **Role Selection Grid**: 4 role cards (admin, manager, editor, viewer) showing description and current status
- **Assignment Button**: Updates user's role in database
- **Users by Role List**: Shows all users organized by their current role with color coding
- **Audit Log Section**: Expandable history showing all past role changes with timestamps

State Management:
- `users`: List of all tenant users
- `selectedUser`: Currently selected user for assignment
- `selectedRole`: New role to assign
- `history`: Role change audit log
- `loading/assigning`: Loading states for async operations

### 2. API Endpoints

#### GET /api/tenant/users
**File**: `src/app/api/tenant/users/route.ts`

Returns list of users in a tenant:

```bash
GET /api/tenant/users?tenantSlug=kreatix-default
```

Response:
```json
{
  "users": [
    {
      "id": "user-123",
      "email": "john@example.com",
      "name": "John Smith",
      "roleId": "manager",
      "isActive": true,
      "createdAt": "2025-01-20T10:30:00Z"
    }
  ]
}
```

#### POST /api/tenant/users/assign-role
**File**: `src/app/api/tenant/users/assign-role/route.ts`

Assigns a role to a user:

```bash
POST /api/tenant/users/assign-role
Content-Type: application/json

{
  "userId": "user-123",
  "oldRoleId": "viewer",
  "newRoleId": "manager",
  "tenantSlug": "kreatix-default"
}
```

Response:
```json
{
  "success": true,
  "userId": "user-123",
  "oldRoleId": "viewer",
  "newRoleId": "manager",
  "assignedAt": "2025-02-07T14:30:00Z",
  "assignedBy": "user-1",
  "message": "User role updated from viewer to manager"
}
```

Validation:
- `userId` required
- `newRoleId` must be one of: admin, manager, editor, viewer
- `tenantSlug` required
- Returns 400 if role already assigned to user
- Returns 500 on database error

#### GET /api/tenant/role-history
**File**: `src/app/api/tenant/role-history/route.ts`

Fetches role assignment history:

```bash
GET /api/tenant/role-history?tenantSlug=kreatix-default&limit=50
GET /api/tenant/role-history?tenantSlug=kreatix-default&userId=user-123
```

Response:
```json
{
  "history": [
    {
      "id": "history-1",
      "userId": "user-123",
      "userEmail": "john@example.com",
      "oldRoleId": "viewer",
      "newRoleId": "manager",
      "assignedAt": "2025-02-07T14:30:00Z",
      "assignedByUserId": "user-1",
      "assignedByEmail": "admin@example.com"
    }
  ],
  "total": 1
}
```

### 3. Integration with Tenant Admin

**File**: `src/app/tenant-admin/page.tsx`

The RoleAssignmentPanel is now integrated into the "People & Access" section:

```tsx
} else if (activeNav === "people-access" && canAdmin("people")) {
  return (
    <div className="space-y-8">
      <RoleBuilder tenantSlug={tenantSlug} />
      <RoleAssignmentPanel tenantSlug={tenantSlug} />  {/* NEW */}
      <EmployeeConsole tenantSlug={tenantSlug} />
      <AccessControlPanel tenantSlug={tenantSlug} />
    </div>
  );
}
```

This means:
- Only users with `canAdmin("people")` permission can access role assignment
- It appears alongside other people management tools
- The component is lazy-loaded when admin navigates to "People & Access"

## User Experience Flow

### Scenario 1: Promote Viewer to Manager

1. Admin navigates to **People & Access** section
2. Finds **Assign Users to Roles** section
3. Selects "John Smith" from user dropdown
4. Sees John's current role is "Viewer" (grayed out, marked "Current")
5. Clicks **Manager** card to select new role
6. Clicks **Assign Role** button
7. Sees success message: "Role assigned to John Smith"
8. User list updates to show John as Manager
9. Admin expands role history and sees audit entry

### Scenario 2: View Role Change History

1. Admin scrolls to **Role Assignment History** section
2. Clicks to expand section
3. Sees all role changes in reverse chronological order
4. Each entry shows:
   - User email
   - Old role → New role (visual cards)
   - Assignment timestamp
   - Admin who made the change

## Database Integration (Next Step)

The current implementation uses mock data for development. To integrate with real database:

### 1. Replace GET /api/tenant/users

```typescript
// In src/app/api/tenant/users/route.ts
export async function GET(request: NextRequest) {
  const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");

  const result = await db.query(
    `SELECT id, email, name, role_id, is_active, created_at 
     FROM tenant_users 
     WHERE tenant_slug = $1 
     AND is_active = true
     ORDER BY email ASC`,
    [tenantSlug]
  );

  return NextResponse.json({
    users: result.rows.map(row => ({
      id: row.id,
      email: row.email,
      name: row.name,
      roleId: row.role_id,
      isActive: row.is_active,
      createdAt: row.created_at.toISOString()
    }))
  });
}
```

### 2. Replace POST /api/tenant/users/assign-role

```typescript
// In src/app/api/tenant/users/assign-role/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId, oldRoleId, newRoleId, tenantSlug } = body;
  
  // Get current user from session
  const currentUser = getCurrentUser(request);
  
  // Transaction: update user + insert history
  await db.query('BEGIN');
  
  try {
    // Update role
    await db.query(
      `UPDATE tenant_users SET role_id = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_slug = $3`,
      [newRoleId, userId, tenantSlug]
    );
    
    // Insert audit log
    await db.query(
      `INSERT INTO role_history 
       (tenant_slug, user_id, old_role_id, new_role_id, assigned_by_user_id, assigned_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [tenantSlug, userId, oldRoleId, newRoleId, currentUser.id]
    );
    
    await db.query('COMMIT');
    
    return NextResponse.json({
      success: true,
      userId,
      newRoleId,
      message: `Role updated to ${newRoleId}`
    });
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}
```

### 3. Replace GET /api/tenant/role-history

```typescript
// In src/app/api/tenant/role-history/route.ts
export async function GET(request: NextRequest) {
  const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
  const userId = request.nextUrl.searchParams.get("userId");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50", 10);

  let query = `
    SELECT 
      rh.id,
      rh.user_id,
      tu.email,
      rh.old_role_id,
      rh.new_role_id,
      rh.assigned_at,
      rh.assigned_by_user_id,
      ab.email as assigned_by_email
    FROM role_history rh
    LEFT JOIN tenant_users tu ON rh.user_id = tu.id
    LEFT JOIN tenant_users ab ON rh.assigned_by_user_id = ab.id
    WHERE rh.tenant_slug = $1
  `;

  const params: any[] = [tenantSlug];
  let paramCount = 1;

  if (userId) {
    paramCount++;
    query += ` AND rh.user_id = $${paramCount}`;
    params.push(userId);
  }

  query += ` ORDER BY rh.assigned_at DESC LIMIT ${limit}`;

  const result = await db.query(query, params);

  return NextResponse.json({
    history: result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.email,
      oldRoleId: row.old_role_id,
      newRoleId: row.new_role_id,
      assignedAt: row.assigned_at.toISOString(),
      assignedByUserId: row.assigned_by_user_id,
      assignedByEmail: row.assigned_by_email
    })),
    total: result.rows.length
  });
}
```

## Testing Guide

### Development Testing (Header-Based)

With mock data, test the UI locally:

```bash
# Navigate to Tenant Admin > People & Access
# RoleAssignmentPanel appears between RoleBuilder and EmployeeConsole
```

### Manual Testing Scenarios

1. **Assign first role**
   - Select a viewer user
   - Promote to manager
   - Verify success message
   - Check user now shows as manager in list

2. **Cannot assign same role**
   - Select a user
   - Try to click their current role
   - Button should be disabled with "Current" badge
   - Assignment button is disabled

3. **Audit log tracking**
   - Make several role assignments
   - Expand role history
   - Verify all changes are shown in reverse chronological order
   - Dates and admin names are correct

### Database Testing (Once DB Connected)

```sql
-- Check users table
SELECT id, email, role_id FROM tenant_users WHERE tenant_slug = 'kreatix-default';

-- Check audit log
SELECT * FROM role_history WHERE tenant_slug = 'kreatix-default' ORDER BY assigned_at DESC;

-- Verify constraints
-- Role assignments should only allow valid roles: admin, manager, editor, viewer
-- Old and new roles should exist in roles table
```

## Type Safety

All user/role interfaces are properly typed:

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  roleId: string;  // "admin" | "manager" | "editor" | "viewer"
  isActive: boolean;
  createdAt: string;
}

interface RoleHistoryEntry {
  id: string;
  userId: string;
  userEmail: string;
  oldRoleId: string | null;  // null for initial assignment
  newRoleId: string;
  assignedAt: string;
  assignedByUserId: string | null;
  assignedByEmail: string | null;
}
```

## Files Created/Modified

```
NEW:
  src/app/api/tenant/users/route.ts
  src/app/api/tenant/users/assign-role/route.ts
  src/app/api/tenant/role-history/route.ts
  src/app/tenant-admin/sections/role-assignment.tsx
  PHASE2_ROLE_ASSIGNMENT_GUIDE.md (this file)

MODIFIED:
  src/app/tenant-admin/page.tsx
    - Added import for RoleAssignmentPanel
    - Integrated into "people-access" section rendering
```

## What's Next

### Phase 3: API Endpoint Protection
- [ ] Add permission checks to all API routes
- [ ] Enforce write/admin permissions before mutations
- [ ] Return 403 Forbidden for insufficient permissions
- [ ] Validate request user has permission to perform action

### Phase 4: Action Button Gating
- [ ] Hide Create button if user lacks write permission
- [ ] Hide Edit/Delete if user lacks admin permission
- [ ] Disable buttons visually when permission lacks
- [ ] Client-side checks + server-side enforcement

## Troubleshooting

**Q: RoleAssignmentPanel not showing?**
- Ensure you're logged in as admin
- Check that `canAdmin("people")` returns true
- Open browser console for errors
- Verify import statement was added to page.tsx

**Q: Role assignment fails silently?**
- Check browser console for network errors
- Ensure `tenantSlug` is correct
- Verify all required fields are sent in POST request
- Mock API should always succeed for now

**Q: Audit log not updating?**
- Log is only fetched when you click to expand
- Make role assignment first, then expand history
- Check network tab to see if GET request succeeds

**Q: User list shows old data?**
- Component doesn't auto-refresh after assignment
- Manual refresh is implemented (after 500ms delay)
- Or manually refresh page to see latest state

## Summary

Phase 2 provides the **complete UI for user role management**. Admins can:
- ✅ Assign users to roles
- ✅ Track role change history
- ✅ See all users by current role
- ✅ Enforce role uniqueness per user

All data flows through the auth integration from Phase 1. Once database queries are implemented, the system will be fully functional with real data persistence and audit trails.

**Status**: ✅ COMPLETE - Ready for Database Integration

---

Next: Phase 3 (API Endpoint Protection) - Add permission checks to other routes to enforce the RBAC system on all API operations
