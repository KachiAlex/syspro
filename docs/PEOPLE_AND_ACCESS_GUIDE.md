# People & Access: Team Permissions Guide

## Overview

The redesigned **Team Permissions** interface makes it easier to manage who can do what in your system. Instead of technical jargon, we use clear, intuitive language and step-by-step workflows.

## What's New

### 1. **Clearer Language**
- **"View"** instead of "Read" - easily understood as read-only access
- **"Edit"** instead of "Write" - clearly means creating and modifying records  
- **"Manage"** instead of "Admin" - intuitive for admin-level permissions
- **"Role"** instead of "Access Control" - more familiar to business users

### 2. **Role Templates**
Start with predefined templates instead of building from scratch:

| Template | Best For | Permissions |
|----------|----------|-------------|
| **Viewer** | Read-only users, auditors | View all areas |
| **Editor** | Team members who create/edit | View & Edit all areas except Integrations |
| **Manager** | Department leads, supervisors | View, Edit & Manage all areas except Integrations |
| **Administrator** | System admins, IT staff | Full access including Integration management |

### 3. **Module Descriptions**
Each area shows what it covers:

- 👥 **Sales & CRM** - Manage customer relationships, leads, and sales opportunities
- 💰 **Finance & Accounting** - Handle invoices, budgets, financial reports, and accounting
- 👨‍💼 **People & HR** - Manage employees, attendance, payroll, and team information
- 📊 **Projects** - Plan and track projects, timelines, and team assignments
- 🧾 **Billing & Invoicing** - Create invoices, manage billing, and track payments
- ⚙️ **Integrations & Security** - Configure integrations, manage API keys, and security settings

### 4. **Step-by-Step Creation**
Creating a new role is now broken into 3 clear steps:
1. **Step 1** - Start with a template (optional)
2. **Step 2** - Name your role
3. **Step 3** - Customize permissions

### 5. **Better Visual Organization**
- Roles are displayed in cards showing all their permissions at a glance
- Easy-to-scan layout with icons and descriptions
- Active editing state is highlighted with a ring and background color
- Clear action buttons (Edit, Delete)

## How to Use

### Creating a New Role

1. **Click "Create Role"** button in the "Team Permissions" section
2. **(Optional) Choose a template** - Select Viewer, Editor, Manager, or Administrator to start with predefined settings
   - This is optional - you can skip templates and customize from scratch
3. **Enter the role name** - Give it a descriptive name your team will understand
   - Good examples: "Sales Manager", "Finance Lead", "Support Team Lead"
   - Avoid generic names like "User1" or "Role A"
4. **Set permissions for each area** - For each business area:
   - Check **View** if they need to see information
   - Check **Edit** if they need to create or modify records
   - Check **Manage** if they need administrative access
   - You can check multiple permissions for the same area (e.g., View + Edit)
5. **Click "Create Role"** - The role is now available for assignment to team members

### Editing an Existing Role

1. Find the role in the "Current Roles" section
2. Click the **Edit** button
3. Modify the permissions as needed
4. Click **Save Changes**

**Note:** Existing team members with this role will immediately have their access updated.

### Deleting a Role

1. Find the role in the "Current Roles" section
2. Click the **Delete** button
3. Confirm - you'll be warned that team members will lose access

**Warning:** Always ensure users have another role assigned before deleting a role.

## Permission Levels Explained

### View (Read-Only)
- Can see all records and information in this area
- Cannot create new records
- Cannot modify existing records
- Perfect for: Managers who need to monitor, auditors, read-only stakeholders

### Edit (Create & Modify)
- Can create new records
- Can modify existing records
- **Does not** include deletion rights (except where integrated with Manage)
- Perfect for: Team members who work with data daily

### Manage (Admin Access)
- Can create, modify, and delete records
- Can change settings and configurations
- Can view audit logs and administrative features
- Perfect for: Department heads, system administrators

## Best Practices

### 1. **Use Templates as Starting Points**
Don't create roles from scratch if a template is close. It's faster and fewer mistakes.

### 2. **Name Roles by Function, Not by Person**
✅ Good: "Sales Manager", "Junior Accountant", "Support Lead"  
❌ Bad: "John's Role", "Person A", "Temporary Access"

### 3. **Principle of Least Privilege**
Give users only the permissions they need:
- Start with "View" only
- Add "Edit" if they need to create/modify records
- Use "Manage" only for administrative functions

### 4. **Review Roles Quarterly**
As your team grows and responsibilities change:
- Update role definitions
- Remove unused roles
- Adjust permission levels as needed

### 5. **Test New Roles**
Before assigning a new role to multiple users:
- Have one person test it
- Verify they have access to what they need
- Ensure they don't have unwanted access

### 6. **Document Your Roles**
Keep a simple spreadsheet with:
- Role name
- Purpose
- Number of users
- When it was last reviewed

## Common Scenarios

### Scenario 1: New Sales Rep
**Steps:**
1. Use the "Editor" template
2. Rename to "Sales Representative"  
3. Remove "Finance" and "People" Edit permissions (keep View on Finance for invoice tracking)
4. Remove "Integrations" access entirely
5. Save and assign

**Result:** Access to CRM (View+Edit), Finance (View), Projects (View+Edit), and Billing (View)

### Scenario 2: Finance Manager
**Steps:**
1. Use the "Manager" template
2. Rename to "Finance Manager"
3. Remove "CRM" Edit/Manage (keep View only)
4. Remove "People" Edit/Manage (keep View only)
5. Remove "Integrations" Edit/Manage (keep View only)
6. Save and assign

**Result:** Full management of Finance. View-only on CRM, People, and Projects.

### Scenario 3: HR Admin
**Steps:**
1. Use the "Editor" template
2. Rename to "HR Administrator"
3. Keep only "People" (Edit+Manage)
4. Remove all other module access
5. Save and assign

**Result:** Full access to People/HR only. No access to other areas.

## Permission Matrix Quick Reference

```
                CRM    Finance  People  Projects  Billing  Integrations
Viewer          V      V        V       V         V        -
Editor          VE     VE       VE      VE        VE       -
Manager         VEM    VEM      VEM     VEM       VEM      -
Admin           VEM    VEM      VEM     VEM       VEM      VEM

V = View, E = Edit, M = Manage
```

## Troubleshooting

### "User doesn't see the feature they need"
1. Check if the role has "View" permission for that area
2. If they need to create/edit, check for "Edit" permission
3. Verify the role is assigned to the user's account

### "Too many people have admin access"
1. Review current roles and identify unnecessary admin permissions
2. Create more granular roles using templates as a base
3. Slowly migrate users to the new roles
4. Document the migration process

### "Role is used by many people but needs changes"
1. Create a new, improved role with a version number (e.g., "Sales Manager v2")
2. Assign to new users going forward
3. Migrate existing users gradually
4. Delete the old role when no longer in use

## Technical Details (For Developers)

### Module Names
System modules are:
- `crm` - Sales & CRM module
- `finance` - Finance & Accounting module
- `people` - People & HR module
- `projects` - Projects module
- `billing` - Billing & Invoicing module
- `integrations` - Integrations & Security module

### Permission Fields
Each module permission has three boolean fields:
- `read: boolean` - View access
- `write: boolean` - Create/Edit access
- `admin: boolean` - Admin/Manage access

### API Interaction
To create a role via API:
```json
POST /api/tenant/access-control
{
  "roleName": "Custom Role",
  "moduleAccess": [
    { "module": "crm", "read": true, "write": true, "admin": false },
    { "module": "finance", "read": true, "write": false, "admin": false }
  ]
}
```

## Migration from Old System

If you were using the old "Access Control Panel":

| Old Term | New Term | Mapping |
|----------|----------|---------|
| "Access control" | "Role" | Same concept |
| "Module" | "Area" | CRM, Finance, etc. |
| "Read" | "View" | Exact same permission |
| "Write" | "Edit" | Exact same permission |
| "Admin" | "Manage" | Exact same permission |

All existing roles and permissions are automatically converted. No action needed!

## Support & Questions

- For permission-related questions, see the "Understanding Permissions" section above
- For user assignment questions, check the team member management docs
- For technical developer questions, see the Technical Details section

---

**Last Updated:** January 2025
**Version:** 2.0 (Redesigned Interface)
