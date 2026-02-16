# Superadmin API Specification

## Overview
This API provides endpoints for superadmin users to manage tenants, licenses, and tenant administrators in the multi-tenant ERP system.

## Authentication
All endpoints require superadmin authentication via Bearer token in Authorization header.

## Endpoints

### Tenants

#### GET /api/superadmin/tenants
- Description: Retrieve list of all tenants
- Response: Array of tenant objects
- Status: 200 OK

#### POST /api/superadmin/tenants
- Description: Create a new tenant
- Body: { name: string, slug: string, seats: number, ... }
- Response: Created tenant object
- Status: 201 Created

#### GET /api/superadmin/tenants/[slug]
- Description: Get details of a specific tenant
- Response: Tenant object with details, licenses, admins
- Status: 200 OK

#### PUT /api/superadmin/tenants/[slug]
- Description: Update tenant details
- Body: Partial tenant object
- Response: Updated tenant object
- Status: 200 OK

#### DELETE /api/superadmin/tenants/[slug]
- Description: Delete a tenant
- Status: 204 No Content

### Licenses

#### GET /api/superadmin/licenses
- Description: Retrieve list of all licenses
- Response: Array of license objects
- Status: 200 OK

#### POST /api/superadmin/licenses
- Description: Create a new license
- Body: { tenantSlug: string, type: string, seats: number, expiry: date, ... }
- Response: Created license object
- Status: 201 Created

#### PUT /api/superadmin/licenses/[id]
- Description: Update license
- Body: Partial license object
- Response: Updated license object
- Status: 200 OK

#### DELETE /api/superadmin/licenses/[id]
- Description: Delete license
- Status: 204 No Content

### Tenant Admins

#### GET /api/superadmin/tenants/[slug]/admins
- Description: Get list of admins for a tenant
- Response: Array of admin objects
- Status: 200 OK

#### POST /api/superadmin/tenants/[slug]/admins
- Description: Create a new tenant admin
- Body: { email: string, name: string, role: string, ... }
- Response: Created admin object
- Status: 201 Created

#### PUT /api/superadmin/tenants/[slug]/admins/[id]
- Description: Update tenant admin
- Body: Partial admin object
- Response: Updated admin object
- Status: 200 OK

#### DELETE /api/superadmin/tenants/[slug]/admins/[id]
- Description: Delete tenant admin
- Status: 204 No Content

## Error Responses
- 400 Bad Request: Invalid input
- 401 Unauthorized: Missing/invalid auth
- 403 Forbidden: Insufficient permissions
- 404 Not Found: Resource not found
- 500 Internal Server Error: Server error