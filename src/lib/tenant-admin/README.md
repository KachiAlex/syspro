# Tenant Admin Module

Comprehensive tenant administration system for the Syspro ERP platform. Provides enterprise-grade tools for managing departments, roles, employees, approvals, workflows, modules, integrations, and security policies.

## Architecture

```
src/lib/tenant-admin/
├── types.ts              # TypeScript interfaces & types
├── service.ts            # Business logic layer
├── validation.ts         # Zod validation schemas
├── utils.ts              # Utility functions & helpers
├── hooks.ts              # React hooks for UI
├── schema.ts             # Database schema & migrations
├── index.ts              # Barrel exports
└── README.md             # This file

src/app/api/tenant/
├── departments/
├── roles/
├── employees/
├── approvals/
├── workflows/
├── modules/
├── integrations/
├── access-control/
└── ... (other endpoints)

src/app/tenant-admin/sections/
├── department-management.tsx
├── role-builder.tsx
├── role-assignment.tsx
├── employee-console.tsx
├── approval-designer.tsx
├── workflows.tsx
├── module-registry.tsx
└── ... (other UI sections)
```

## Core Features

### 1. Department Management
- Hierarchical department structure
- Budget allocation and cost center tracking
- Manager assignment
- Department-level permissions

**Files:**
- `service.ts` - `DepartmentService`
- `validation.ts` - `CreateDepartmentSchema`
- `src/app/tenant-admin/sections/department-management.tsx`

**API Endpoints:**
- `GET /api/tenant/departments` - List all departments
- `POST /api/tenant/departments` - Create department
- `PATCH /api/tenant/departments/:id` - Update department
- `DELETE /api/tenant/departments/:id` - Delete department

### 2. Role Builder & RBAC
- Custom role creation with fine-grained permissions
- Tenant/Region/Branch scoping
- Role assignment to users
- Permission management by module

**Files:**
- `service.ts` - `RoleService`
- `validation.ts` - `CreateRoleSchema`, `UpdateRoleSchema`
- `src/app/tenant-admin/sections/role-builder.tsx`
- `src/app/tenant-admin/sections/role-assignment.tsx`

**API Endpoints:**
- `GET /api/tenant/roles` - List roles
- `POST /api/tenant/roles` - Create role
- `PATCH /api/tenant/roles/:id` - Update role
- `DELETE /api/tenant/roles/:id` - Delete role
- `POST /api/tenant/users/assign-role` - Assign role to user

### 3. Employee Management
- Employee lifecycle management (hiring, transfers, termination)
- Department and manager assignment
- Role-based access in employee context
- Geographic distribution (region, branch)

**Files:**
- `service.ts` - `EmployeeService`
- `validation.ts` - `CreateEmployeeSchema`
- `src/app/tenant-admin/sections/employee-console.tsx`

**API Endpoints:**
- `GET /api/tenant/employees` - List employees
- `POST /api/tenant/employees` - Create employee
- `PATCH /api/tenant/employees/:id` - Update employee
- `DELETE /api/tenant/employees/:id` - Deactivate employee

### 4. Approval Flows
- Design multi-step approval workflows
- Role-based and user-based approval routing
- Auto-escalation and timeout handling
- Audit trail with comments

**Files:**
- `service.ts` - `ApprovalFlowService`
- `validation.ts` - `CreateApprovalFlowSchema`
- `src/app/tenant-admin/sections/approval-designer.tsx`
- `src/app/api/tenant/approvals/complete-handler.ts`

**API Endpoints:**
- `GET /api/tenant/approvals/flows` - List approval flows
- `POST /api/tenant/approvals/flows` - Create approval flow
- `POST /api/tenant/approvals/requests` - Create approval request
- `GET /api/tenant/approvals/requests` - List pending approvals
- `PATCH /api/tenant/approvals/requests/:id` - Approve/reject request

### 5. Access Control
- Module-level access management
- Temporary access grants with expiration
- Data filtering by department/region
- Permission override history

**Files:**
- `service.ts` - `AccessControlService`
- `validation.ts` - `UpdateAccessControlSchema`
- `src/app/tenant-admin/sections/access-control.tsx`

**API Endpoints:**
- `GET /api/tenant/access-control` - Get access rules
- `PATCH /api/tenant/access-control` - Update module access
- `POST /api/tenant/access-control/temporary` - Grant temporary access
- `DELETE /api/tenant/access-control/temporary/:id` - Revoke temporary access

### 6. Workflow Engine
- Trigger-based workflow automation
- Event, manual, schedule, and condition triggers
- Multi-step execution with state management
- Workflow execution history

**Files:**
- `service.ts` - `WorkflowService`
- `validation.ts` - `CreateWorkflowSchema`
- `src/app/tenant-admin/sections/workflows.tsx`

**API Endpoints:**
- `GET /api/tenant/workflows` - List workflows
- `POST /api/tenant/workflows` - Create workflow
- `PATCH /api/tenant/workflows/:id` - Update workflow
- `DELETE /api/tenant/workflows/:id` - Delete workflow
- `POST /api/tenant/workflows/:id/execute` - Execute workflow

### 7. Module Registry & Feature Flags
- Enable/disable modules per tenant
- Regional/branch-level module targeting
- Feature flag management with rollout control
- Module dependencies

**Files:**
- `service.ts` - `ModuleService`
- `validation.ts` - `UpdateModuleSchema`
- `src/app/tenant-admin/sections/module-registry.tsx`

**API Endpoints:**
- `GET /api/tenant/modules` - List modules
- `PATCH /api/tenant/modules/:id` - Toggle module
- `POST /api/tenant/modules/:id/flags` - Set feature flag

### 8. Integrations & API
- OAuth, API Key, Webhook, Custom integration support
- Integration status monitoring
- API key generation and management
- Rate limiting and expiration

**Files:**
- API route handlers (to be implemented)
- `src/app/tenant-admin/sections/integrations.tsx`

**API Endpoints:**
- `GET /api/tenant/integrations` - List integrations
- `POST /api/tenant/integrations` - Create integration
- `PATCH /api/tenant/integrations/:id` - Update integration
- `GET /api/tenant/api-keys` - List API keys
- `POST /api/tenant/api-keys` - Generate API key

### 9. Security & Compliance
- Security policy management
- IP whitelisting, MFA enforcement
- Audit logging for all operations
- Data access logging

**Files:**
- `service.ts` - `AuditService`
- `src/app/tenant-admin/sections/security.tsx`

**API Endpoints:**
- `GET /api/tenant/security/policies` - List security policies
- `PATCH /api/tenant/security/policies/:id` - Update policy
- `GET /api/tenant/security/audit` - Get audit logs

### 10. Analytics & Reporting
- Tenant usage metrics
- User adoption metrics
- System performance monitoring
- Compliance reporting

**Files:**
- `src/app/tenant-admin/sections/analytics.tsx`
- `src/app/tenant-admin/sections/reports.tsx`

## Database Schema

All tenant-admin data is stored in PostgreSQL with the following table prefix: `admin_*`

Run migrations on startup:

```typescript
import { initializeTenantAdmin } from '@/lib/tenant-admin/schema';

// In your app initialization
await initializeTenantAdmin();
```

## Usage Examples

### Service Layer

```typescript
import { DepartmentService, EmployeeService, RoleService } from '@/lib/tenant-admin';

const deptService = new DepartmentService();
const empService = new EmployeeService();
const roleService = new RoleService();

// Create department
const deptId = await deptService.create('tenant-1', {
  name: 'Engineering',
  description: 'Engineering department',
  costCenter: 'ENG-001'
});

// Create employee
const empId = await empService.create('tenant-1', {
  name: 'John Doe',
  email: 'john@example.com',
  departmentId: deptId
});

// Get department hierarchy
const hierarchy = await deptService.getHierarchy('tenant-1');
```

### React Hooks

```typescript
import { useDepartments, useEmployees, useRoles } from '@/lib/tenant-admin/hooks';

export function MyComponent() {
  const { departments, loading, createDepartment } = useDepartments('tenant-1');
  const { employees } = useEmployees('tenant-1');
  const { roles } = useRoles('tenant-1');

  return (
    <div>
      {loading ? 'Loading...' : departments.map(d => (
        <div key={d.id}>{d.name}</div>
      ))}
    </div>
  );
}
```

### API Routes

```typescript
// src/app/api/tenant/departments/route.ts
import { GET, POST } from '@/app/api/tenant/departments/handlers';

export { GET, POST };
```

## Validation

All API inputs are validated using Zod schemas:

```typescript
import { CreateDepartmentSchema, validateSchema } from '@/lib/tenant-admin/validation';

const result = validateSchema(CreateDepartmentSchema, requestBody);
if (!result.success) {
  console.error(result.error.flatten());
}
```

## Authentication & Authorization

All tenant-admin endpoints require:
1. **Authentication**: Valid JWT token from auth provider
2. **Authorization**: Appropriate role and module permissions
3. **Tenant Validation**: Request must include valid `tenantSlug`

```typescript
const context = validateTenantContext(request, 'write');
// context.tenantSlug, context.userId, context.userPermissions
```

## Audit Logging

All operations are logged for compliance:

```typescript
const auditService = new AuditService();

await auditService.log(
  'tenant-1',
  'user-123',
  'create',
  'department',
  departmentId,
  { name: 'Engineering' }
);

// Query audit logs
const logs = await auditService.getForResource('tenant-1', 'department', departmentId);
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

```typescript
import { checkRateLimit } from '@/lib/tenant-admin/utils';

if (!checkRateLimit(userId, 100, 60000)) {
  return errorResponse('Rate limit exceeded', 429);
}
```

## Testing

Add unit tests for service layer:

```typescript
// __tests__/tenant-admin/department.test.ts
describe('DepartmentService', () => {
  it('should create a department', async () => {
    const service = new DepartmentService();
    const id = await service.create('tenant-1', { name: 'Eng' });
    expect(id).toBeDefined();
  });
});
```

## Next Steps

- [ ] Billing & Subscription service implementation
- [ ] Advanced analytics aggregation
- [ ] Integration webhook processors
- [ ] Workflow execution engine
- [ ] Comprehensive test coverage
- [ ] Performance optimization for large datasets
- [ ] API documentation (OpenAPI/Swagger)

## Support

For issues or questions about the tenant-admin module, refer to the main project documentation or contact the development team.
