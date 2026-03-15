# Superadmin API Input Validation Requirements

This document describes all input validation requirements for the Superadmin portal APIs.

## Overview

All Superadmin endpoints use **Zod** for runtime type validation. Validation occurs at two levels:
- **Query Parameters**: Validated when present (GET requests)
- **Request Body**: Validated when present (POST/PUT requests)

When validation fails, endpoints return **HTTP 400** with detailed error messages.

## Validation Error Format

All validation errors follow this format:

```json
{
  "error": "Invalid request body" | "Invalid query parameters",
  "details": [
    {
      "field": "fieldName",
      "message": "Field validation message"
    }
  ]
}
```

Example:
```json
{
  "error": "Invalid request body",
  "details": [
    {
      "field": "slugs",
      "message": "Max 100 slugs per request"
    },
    {
      "field": "slugs.0",
      "message": "String must contain at most 100 character(s)"
    }
  ]
}
```

## Endpoint Reference

### GET /api/superadmin/tenants

Fetch paginated list of tenants with optional search.

**Query Parameters:**
```typescript
{
  page?: number           // Default: 1, Min: 1
  limit?: number          // Default: 20, Min: 1, Max: 100
  q?: string              // Search query (max 255 chars), Min: 1 char to search
}
```

**Validation Rules:**
- `page` must be integer ≥ 1
- `limit` must be integer between 1-100
- `q` must be string max 255 characters

**Example Requests:**
```bash
# Get first page with default limit
GET /api/superadmin/tenants

# Get page 2 with custom limit
GET /api/superadmin/tenants?page=2&limit=50

# Search tenants
GET /api/superadmin/tenants?q=acme&page=1&limit=20
```

---

### POST /api/superadmin/tenants

Create a new tenant.

**Request Body:**
```typescript
{
  name: string            // Required, 1-255 chars
  slug: string            // Required, 1-100 chars, [a-z0-9-] only
  seats: number           // Required, integer, 1-100000
}
```

**Validation Rules:**
- `name` must be non-empty string, max 255 characters
- `slug` must be lowercase letters, numbers, and hyphens only (regex: `^[a-z0-9-]+$`)
- `seats` must be integer between 1-100000

**Example Request:**
```json
{
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "seats": 100
}
```

---

### POST /api/superadmin/tenants/bulk-activate

Activate multiple tenants (set status = 'active').

**Request Body:**
```typescript
{
  slugs: string[]         // Required, array of 1-100 strings
}
```

**Validation Rules:**
- `slugs` must be non-empty array
- Each slug 1-100 characters
- Max 100 slugs per request
- Rate limit: 50 requests/min per IP

**Example Request:**
```json
{
  "slugs": ["tenant-1", "tenant-2", "tenant-3"]
}
```

**Error Example:**
```json
{
  "error": "Invalid request body",
  "details": [
    {
      "field": "slugs",
      "message": "Max 100 slugs per request"
    }
  ]
}
```

---

### POST /api/superadmin/tenants/bulk-suspend

Suspend multiple tenants (set status = 'suspended').

**Request Body:**
```typescript
{
  slugs: string[]         // Required, array of 1-100 strings
}
```

**Validation Rules:**
- Same as bulk-activate
- Rate limit: 50 requests/min per IP

---

### POST /api/superadmin/tenants/bulk-delete

Delete multiple tenants permanently.

**Request Body:**
```typescript
{
  slugs: string[]         // Required, array of 1-100 strings
}
```

**Validation Rules:**
- Same as bulk-activate
- **Rate limit: 10 requests/min per IP (stricter for destructive ops)**

**Security Notes:**
- All deletes are logged to audit_logs table
- Timestamp, IP address, and user details recorded
- Cannot be undone

---

### GET /api/superadmin/audit-logs

Fetch paginated audit log entries.

**Query Parameters:**
```typescript
{
  page?: number           // Default: 1, Min: 1
  limit?: number          // Default: 50, Min: 1, Max: 100
  action?: string         // Optional: 'create' | 'activate' | 'suspend' | 'delete'
  entitySlug?: string     // Optional, max 100 chars
}
```

**Validation Rules:**
- `page` must be integer ≥ 1
- `limit` must be integer between 1-100
- `action` must be one of enum values (if provided)
- `entitySlug` must be string max 100 characters

**Example Requests:**
```bash
# Get first page of audit logs
GET /api/superadmin/audit-logs

# Get delete actions only
GET /api/superadmin/audit-logs?action=delete&limit=50

# Get logs for specific tenant
GET /api/superadmin/audit-logs?entitySlug=acme-corp&page=1
```

---

## Validation Utilities

### Using Zod Schemas Directly

```typescript
import { TenantPaginationSchema, safeParse } from '@/lib/validation';

// Validate data
const validation = safeParse(TenantPaginationSchema, { page: '1', limit: '20' });

if (!validation.success) {
  console.error(validation.error.errors);
  // Handle error
} else {
  const { page, limit } = validation.data; // Typed!
  // Use validated data
}
```

### Using API Validation Middleware

```typescript
import { validateRequestBody, validateQueryParams } from '@/lib/api-validation';
import { CreateTenantSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  // Option 1: Validate body with early return
  const bodyResult = await validateRequestBody(request, CreateTenantSchema);
  if (!bodyResult.valid) {
    return bodyResult.response; // 400 error response
  }

  const { name, slug, seats } = bodyResult.data; // Typed!
  
  // Option 2: Validate query params
  const queryResult = validateQueryParams(request, TenantPaginationSchema);
  if (!queryResult.valid) {
    return queryResult.response; // 400 error response
  }

  const { page, limit } = queryResult.data; // Typed!
}
```

---

## Rate Limiting

All Superadmin API endpoints have rate limiting:

| Operation | Limit | Duration |
|-----------|-------|----------|
| General (activate, suspend) | 50 requests | per minute |
| Delete operations | 10 requests | per minute |

**Rate Limit Response:**
```json
{
  "error": "Rate limit exceeded"
}
```

HTTP Status: **429 Too Many Requests**

Header: `Retry-After: 60` (recommended wait time in seconds)

---

## Audit Logging

All destructive operations are logged:

| Action | Details Logged |
|--------|---|
| **activate** | Tenant slug, count of activated tenants, timestamp, IP |
| **suspend** | Tenant slug, count of suspended tenants, timestamp, IP |
| **delete** | Tenant slug, count of deleted tenants, deletion timestamp, IP |

**Viewing Logs:**
```bash
GET /api/superadmin/audit-logs?action=delete&limit=100&page=1
```

Returns:
```json
{
  "items": [
    {
      "id": "uuid",
      "action": "delete",
      "entity_type": "tenant",
      "entity_id": "123",
      "entity_slug": "acme-corp",
      "details": {
        "count": 3,
        "deleted_at": "2024-03-12T10:30:00Z"
      },
      "user_id": "admin-123",
      "ip_address": "192.168.1.1",
      "created_at": "2024-03-12T10:30:00Z"
    }
  ],
  "page": 1,
  "limit": 100
}
```

---

## Migration Required

The validation system requires database tables:

```bash
# Run migration to set up audit_logs table
psql -U postgres -d syspro < migrations/001_superadmin_optimization.sql
```

This creates:
- `audit_logs` table with JSONB details column
- Indexes for optimal query performance

---

## Best Practices

### 1. Always validate before processing
```typescript
const validation = safeParse(schema, data);
if (!validation.success) {
  return error_response; // Don't process invalid data
}
```

### 2. Use type inference
```typescript
type TenantInput = z.infer<typeof CreateTenantSchema>;
const tenant: TenantInput = validated_data; // Full TypeScript support
```

### 3. Provide clear error messages
Validation errors include field paths and descriptive messages for frontend consumption:
```json
{
  "field": "slugs.0", 
  "message": "String must contain at most 100 character(s)"
}
```

### 4. Respect rate limits
Implement exponential backoff on 429 responses:
```typescript
const delay = parseInt(response.headers['Retry-After']) * 1000;
setTimeout(() => retry(), delay);
```

### 5. Monitor audit logs
Regularly review `/api/superadmin/audit-logs` for suspicious bulk delete operations.

---

## Environment Variables

No additional configuration needed. Validation is built-in and automatic.

For development debugging, validation errors include full details automatically.

---

## Common Validation Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Slug must contain only lowercase letters, numbers, and hyphens" | Invalid slug format | Use regex `^[a-z0-9-]+$` |
| "Max 100 slugs per request" | Too many items | Split into multiple requests |
| "String must contain at most 100 character(s)" | Field too long | Trim or use shorter value |
| "Page must be >= 1" | Invalid pagination | Start from page 1 |
| "Rate limit exceeded" | Too many requests | Wait before retrying (see Retry-After header) |

---

## Testing

```bash
# Test invalid pagination
curl "http://localhost:3000/api/superadmin/tenants?page=0&limit=1000"
# Returns 400 with validation errors

# Test invalid bulk slugs
curl -X POST "http://localhost:3000/api/superadmin/tenants/bulk-delete" \
  -H "Content-Type: application/json" \
  -d '{"slugs": []}'
# Returns 400: "At least one slug required"

# Test rate limiting  
for i in {1..60}; do
  curl -X POST "http://localhost:3000/api/superadmin/tenants/bulk-delete" \
    -H "Content-Type: application/json" \
    -d '{"slugs": ["test"]}'
done
# After 10 requests, returns 429
```
