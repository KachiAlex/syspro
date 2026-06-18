# Tenant Admin API Endpoints

This directory contains all API routes for the tenant-admin module. All endpoints follow a consistent pattern with standardized error handling, validation, audit logging, and rate limiting via the `@/lib/tenant-admin` utilities.

## Architecture

All routes use the following infrastructure:
- **Service Layer**: `@/lib/tenant-admin/service.ts` - Business logic layer
- **Validation**: `@/lib/tenant-admin/validation.ts` - Zod schemas for request validation
- **Utilities**: `@/lib/tenant-admin/utils.ts` - Common helpers (auth, responses, pagination, audit, rate limiting)
- **Types**: `@/lib/tenant-admin/types.ts` - TypeScript type definitions
- **Database Schema**: `@/lib/tenant-admin/schema.ts` - PostgreSQL schema

## API Routes

### Core Resources

#### Departments
- **GET** `/api/tenant/departments` - List all departments with pagination/filtering
  - Query params: `page`, `limit`, `sort`, `order`
  - Requires: `read` permission

- **POST** `/api/tenant/departments` - Create department
  - Body: `{ name, description?, parentDepartmentId?, costCenter?, manager? }`
  - Requires: `write` permission
  - Returns: 201 with department object

- **PATCH** `/api/tenant/departments?id=<id>` - Update department
  - Body: `{ name?, description?, parentDepartmentId?, budget?, costCenter?, manager? }`
  - Requires: `write` permission
  - Returns: 200 with updated department

- **DELETE** `/api/tenant/departments?id=<id>` - Delete department
  - Requires: `delete` permission
  - Returns: 200 with success message

#### Roles
- **GET** `/api/tenant/roles` - List all roles
  - Query params: `page`, `limit`, `sort`, `order`
  - Requires: `read` permission

- **POST** `/api/tenant/roles` - Create role
  - Body: `{ name, scope, permissions[], description? }`
  - Scope: `"tenant" | "region" | "branch" | "custom"`
  - Requires: `write` permission
  - Returns: 201 with role object

- **PATCH** `/api/tenant/roles?id=<id>` - Update role
  - Body: `{ name?, permissions?, description? }`
  - Requires: `write` permission

- **DELETE** `/api/tenant/roles?id=<id>` - Delete role
  - Requires: `delete` permission

#### Employees
- **GET** `/api/tenant/employees` - List all employees
  - Query params: `page`, `limit`, `sort`, `order`
  - Requires: `read` permission

- **POST** `/api/tenant/employees` - Create employee
  - Body: `{ name, email, departmentId, phone?, jobTitle?, reportingManagerId?, hireDate? }`
  - Requires: `write` permission
  - Returns: 201 with employee object

- **PATCH** `/api/tenant/employees?id=<id>` - Update employee
  - Body: `{ name?, departmentId?, reportingManagerId?, jobTitle?, status? }`
  - Status: `"active" | "inactive" | "on-leave" | "terminated"`
  - Requires: `write` permission

- **DELETE** `/api/tenant/employees?id=<id>` - Delete employee
  - Requires: `delete` permission

### Business Logic

#### Approvals
- **GET** `/api/tenant/approvals` - List approval flows or requests
  - Query params: `type` (flow/request), `page`, `limit`, `sort`, `order`
  - Requires: `read` permission

- **POST** `/api/tenant/approvals?type=<flow|request>` - Create approval resource
  - For flow: `{ name, description?, steps[], autoApproveThreshold? }`
  - For request: `{ flowId, resourceType, resourceId, requestedBy, description? }`
  - Requires: `write` permission
  - Returns: 201 with flow/request object

- **PATCH** `/api/tenant/approvals?id=<id>&type=<flow|request>` - Update approval
  - For flow: `{ name?, description?, steps? }`
  - For request: `{ status?, comments? }`
  - Requires: `write` permission

- **DELETE** `/api/tenant/approvals?id=<id>&type=<flow|request>` - Delete approval
  - Requires: `delete` permission

#### Workflows
- **GET** `/api/tenant/workflows` - List workflows
  - Query params: `page`, `limit`, `sort`, `order`
  - Requires: `read` permission

- **POST** `/api/tenant/workflows?action=<create|execute>` - Create or execute workflow
  - For create: `{ name, description?, type, steps[], isActive?, autoTrigger? }`
  - For execute: `?id=<id>` + `{ resourceType, resourceId, variables? }`
  - Requires: `write` permission
  - Returns: 201 with workflow/execution object

- **PATCH** `/api/tenant/workflows?id=<id>` - Update workflow
  - Body: `{ name?, description?, steps?, isActive? }`
  - Requires: `write` permission

- **DELETE** `/api/tenant/workflows?id=<id>` - Delete workflow
  - Requires: `delete` permission

#### Access Control
- **GET** `/api/tenant/access-control` - List access rules or user access
  - Query params: `userId` (optional), `page`, `limit`, `sort`, `order`
  - Requires: `read` permission

- **POST** `/api/tenant/access-control?action=<grant-temporary>` - Grant temporary access
  - Body: `{ grantedTo, moduleKey, permissions[], expiresAt, justification }`
  - Requires: `write` permission
  - Returns: 201 with access object

- **PATCH** `/api/tenant/access-control?id=<id>&action=<revoke-temporary|update-module>` - Update access
  - For revoke: No body required
  - For update: `{ moduleAccess[] }`
  - Requires: `write` permission

- **DELETE** `/api/tenant/access-control?id=<id>` - Delete access rule
  - Requires: `delete` permission

### Configuration

#### Modules
- **GET** `/api/tenant/modules` - List modules
  - Query params: `page`, `limit`, `sort`, `order`
  - Requires: `read` permission

- **POST** `/api/tenant/modules` - Create module
  - Body: `{ key, name, description?, icon?, enabled?, version?, permissions[] }`
  - Requires: `write` permission
  - Returns: 201 with module object

- **PATCH** `/api/tenant/modules?id=<id>` - Update module
  - Body: `{ name?, description?, enabled?, permissions?, settings? }`
  - Requires: `write` permission

- **DELETE** `/api/tenant/modules?id=<id>` - Delete module
  - Requires: `delete` permission

#### Security
- **GET** `/api/tenant/security?type=<policies|audit>` - Get security policies or audit logs
  - Query params: `type`, `page`, `limit`, `sort`, `order`
  - Requires: `read` permission

- **POST** `/api/tenant/security` - Create security policy
  - Body: `{ name, type, enforced?, settings, description? }`
  - Type: `"mfa" | "password" | "session" | "ip_restriction" | "data_encryption"`
  - Requires: `write` permission
  - Returns: 201 with policy object

- **PATCH** `/api/tenant/security?id=<id>` - Update security policy
  - Body: `{ enforced?, settings? }`
  - Requires: `write` permission

- **DELETE** `/api/tenant/security?id=<id>` - Delete security policy
  - Requires: `delete` permission

#### Integrations
- **GET** `/api/tenant/integrations?type=<integrations|api-keys>` - List integrations or API keys
  - Query params: `type`, `page`, `limit`, `sort`, `order`
  - Requires: `read` permission

- **POST** `/api/tenant/integrations?type=<integration|api-key>` - Create integration or API key
  - For integration: `{ name, type, enabled?, config, description?, webhookUrl? }`
  - For api-key: `{ label, permissions?, expiresAt? }`
  - Requires: `write` permission
  - Returns: 201 with object (API key includes full `key` value - only shown once)

- **PATCH** `/api/tenant/integrations?id=<id>&type=<integration|api-key>&action=<update|revoke>` - Update integration or revoke API key
  - For integration: `{ name?, enabled?, config?, webhookUrl? }`
  - For api-key revoke: No body required
  - Requires: `write` permission

- **DELETE** `/api/tenant/integrations?id=<id>` - Delete integration
  - Requires: `delete` permission

### Analytics & Billing

#### Billing
- **GET** `/api/tenant/billing?type=<invoices|subscriptions|usage|overview>` - Get billing info
  - Query params: `type`, `page`, `limit`
  - Requires: `read` permission

- **POST** `/api/tenant/billing?action=<subscribe>` - Create subscription
  - Body: `{ planId, seats? }`
  - Requires: `write` permission
  - Returns: 201 with subscription object

- **PATCH** `/api/tenant/billing?id=<id>` - Update subscription
  - Body: `{ planId?, seats?, status? }`
  - Status: `"active" | "paused" | "cancelled"`
  - Requires: `write` permission

- **DELETE** `/api/tenant/billing?id=<id>` - Cancel subscription
  - Requires: `delete` permission

#### Analytics
- **GET** `/api/tenant/analytics?type=<reports|metrics|security|overview>` - Get analytics data
  - Query params: `type`, `page`, `limit`
  - Requires: `read` permission
  - Rate limit: 50 req/min (lower than other endpoints for cost)

- **POST** `/api/tenant/analytics?action=<create|export>` - Create report or export
  - For create: `{ name, type, filters?, metrics?, schedule? }`
  - For export: `{ reportId, format, scheduleFor? }`
  - Format: `"csv" | "json" | "pdf" | "xlsx"`
  - Requires: `write` permission
  - Returns: 201 with report/export object

- **PATCH** `/api/tenant/analytics?id=<id>&action=<update|rerun>` - Update or re-run report
  - Body: Custom update payload
  - Requires: `write` permission

- **DELETE** `/api/tenant/analytics?id=<id>` - Delete report
  - Requires: `delete` permission

## Response Format

All successful responses follow this format:
```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "message": "Optional message",
  "pagination": { /* optional pagination info */ }
}
```

Error responses:
```json
{
  "error": "Error message",
  "details": { /* optional validation details */ }
}
```

## Common Query Parameters

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)
- `sort` - Sort field (default: created_at)
- `order` - Sort direction: `"asc" | "desc"` (default: desc)

## Authentication

All endpoints require valid tenant context extracted from request headers/auth tokens:
- `tenantSlug` - Tenant identifier
- `userId` - Authenticated user ID
- `userRole` - User's role
- `userPermissions` - Array of permission strings

All requests are rate-limited per tenant to prevent abuse.

## Audit Logging

All mutations (POST, PATCH, DELETE) are automatically logged with:
- Action type (create, update, delete, etc.)
- Resource type and ID
- User ID
- Changes (before/after for updates)
- Timestamp

## Error Codes

- `400` - Validation error
- `401` - Unauthorized (missing/invalid auth)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found
- `429` - Rate limit exceeded
- `500` - Server error

## Implementation Notes

- All endpoints use consistent validation via Zod schemas
- Error handling is standardized via `handleTenantAdminError()`
- Response formatting is consistent via `successResponse()` and `errorResponse()`
- Pagination is standardized via `getPaginationParams()`
- Audit trails capture all mutations automatically
- Rate limiting is applied per endpoint per tenant
