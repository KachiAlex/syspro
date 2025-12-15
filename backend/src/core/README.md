# Core ERP Engine Services

This directory contains all core microservices that power the ERP system.

## Service Structure

Each service follows this structure:
```
service-name/
├── entities/          # Database entities
├── dto/              # Data Transfer Objects
├── service-name.service.ts
├── service-name.controller.ts
├── service-name.module.ts
└── README.md
```

## Services

### 1. User Service (`user-service/`)
Enhanced user management with 2FA, activity logs, and profile management.

### 2. Role Service (`role-service/`)
Hierarchical RBAC with system, tenant, and module-level roles and permissions.

### 3. Module Registry (`module-registry/`)
Module registration, enabling/disabling, and dependency management.

### 4. Configuration Service (`config-service/`)
Multi-scope configuration and feature flags.

### 5. Notification Service (`notification-service/`) - TODO
Email, SMS, push, and WebSocket notifications.

### 6. Audit Service (`audit-service/`) - TODO
Centralized logging and audit trails.

### 7. File Storage Service (`file-storage/`) - TODO
S3-compatible file storage with image processing.

## Shared Components

Located in `../shared/`:
- Event system (RabbitMQ)
- Common types and utilities
- Pagination helpers
- Decorators

## Adding a New Service

1. Create service directory structure
2. Define entities
3. Create DTOs
4. Implement service logic
5. Create controller
6. Create module
7. Export from module
8. Import in `app.module.ts`

## Best Practices

- Always use `TenantContextService` for tenant isolation
- Publish events for important actions
- Use DTOs for all inputs/outputs
- Add proper validation
- Include Swagger documentation
- Write unit and integration tests

