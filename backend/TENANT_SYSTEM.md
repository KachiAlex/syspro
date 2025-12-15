# Tenant System Documentation

## Overview

The tenant system provides complete multi-tenancy with row-level isolation. All data is automatically filtered by `tenantId` to ensure complete data separation between tenants.

## Architecture

### Core Components

1. **Tenant Entity** - Base tenant model with `id`, `name`, `code`, `isActive`
2. **TenantContextService** - Request-scoped service that stores current tenant
3. **TenantInterceptor** - Automatically extracts and sets tenant from JWT/headers
4. **TenantGuard** - Validates user has access to the requested tenant
5. **Tenant Decorator** - `@Tenant()` for accessing tenantId in controllers/services

### Tenant Resolution Priority

1. `x-tenant-id` header (for tenant switching)
2. JWT payload `tenantId` field
3. User's `organizationId` (fallback)

## Database Schema

### Tenant Entity
```typescript
{
  id: string (UUID)
  name: string
  code: string (unique)
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
```

### All Entities Include
Every entity now has a `tenantId: string` field for row-level isolation.

## API Endpoints

### GET /api/tenants
Get all tenants accessible by current user.
- **Roles**: All authenticated users
- **Response**: List of tenant objects

### GET /api/tenants/:id
Get specific tenant by ID.
- **Roles**: All authenticated users (with tenant access)
- **Guards**: `TenantGuard` (validates access)

### POST /api/tenants
Create a new tenant.
- **Roles**: `SUPER_ADMIN` only
- **Body**: `CreateTenantDto`

### PATCH /api/tenants/:id
Update tenant.
- **Roles**: `SUPER_ADMIN`, `CEO`
- **Guards**: `TenantGuard`

### DELETE /api/tenants/:id
Delete tenant.
- **Roles**: `SUPER_ADMIN` only
- **Guards**: `TenantGuard`

### POST /api/tenants/switch
Switch to a different tenant.
- **Roles**: `SUPER_ADMIN`, `CEO`, `HR`
- **Body**: `{ tenantId: string }`
- **Response**: Success message with new tenantId

### GET /api/tenants/user/accessible
Get all tenants accessible by current user.
- **Roles**: All authenticated users
- **Response**: List of accessible tenant objects

## Usage in Services

### Automatic Tenant Filtering

All services automatically filter by tenant using `TenantContextService`:

```typescript
@Injectable()
export class MyService {
  constructor(
    @InjectRepository(MyEntity)
    private repository: Repository<MyEntity>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll() {
    const tenantId = this.tenantContext.requireTenant();
    return this.repository.find({
      where: { tenantId },
    });
  }
}
```

### Using Tenant Decorator

```typescript
@Get()
async getData(@Tenant() tenantId: string) {
  // tenantId is automatically extracted
  return this.service.findByTenant(tenantId);
}
```

## Tenant Access Control

### User-Tenant Access

Users can have access to multiple tenants via `UserTenantAccess` entity:
- `userId` + `tenantId` = access record
- `isActive` flag for revoking access

### Access Validation

- **SUPER_ADMIN**: Access to all tenants
- **CEO**: Access to all tenants
- **Other roles**: Only tenants they have explicit access to

## Tenant Switching

### For CEO/HR Users

1. Call `POST /api/tenants/switch` with `{ tenantId: "uuid" }`
2. System validates user has access
3. Subsequent requests use `x-tenant-id` header
4. All queries automatically filter by new tenant

### Example

```bash
# Switch tenant
curl -X POST http://localhost:4000/api/tenants/switch \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "new-tenant-uuid"}'

# Use new tenant in requests
curl http://localhost:4000/api/users \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: new-tenant-uuid"
```

## Global Integration

The tenant system is globally integrated:

1. **TenantInterceptor** - Applied globally via `APP_INTERCEPTOR`
2. **TenantContextService** - Request-scoped, available in all modules
3. **Automatic filtering** - All queries include tenantId filter

## Security

- ✅ Row-level isolation enforced at database level
- ✅ Tenant access validation on every request
- ✅ Role-based tenant switching restrictions
- ✅ Automatic tenant injection from JWT
- ✅ Cross-tenant access prevention

## Migration Notes

When adding new entities:

1. Add `tenantId: string` column
2. Inject `TenantContextService` in service
3. Filter queries by `tenantId`
4. Set `tenantId` when creating new records

Example:
```typescript
@Entity('my_entity')
export class MyEntity {
  // ... other fields
  @Column()
  tenantId: string;
}
```

