# Syspro ERP - Architecture Documentation

## 📁 Detailed Folder Structure & Explanations

### Root Level Structure

```
syspro-erp-monorepo/
├── apps/                    # Application layer - deployable applications
├── libs/                    # Library layer - shared code and utilities  
├── docker/                  # Containerization - Docker configurations
├── infrastructure/          # Infrastructure as Code - deployment configs
├── docs/                    # Documentation - architecture, API, guides
├── scripts/                 # Automation - utility and deployment scripts
├── .github/                 # CI/CD - GitHub Actions workflows
├── package.json             # Workspace configuration
├── turbo.json              # Monorepo build configuration
└── README.md               # Project overview and quick start
```

---

## 🏗️ Applications (`apps/`)

### Backend API (`apps/api/`)
**Purpose**: NestJS-based REST API server with multi-tenant architecture

```
apps/api/
├── src/
│   ├── modules/                    # Feature modules (bounded contexts)
│   │   ├── auth/                   # Authentication & authorization
│   │   │   ├── controllers/        # HTTP request handlers
│   │   │   ├── services/           # Business logic
│   │   │   ├── guards/             # Route protection
│   │   │   ├── strategies/         # Passport strategies
│   │   │   └── dto/                # Data transfer objects
│   │   ├── tenant/                 # Tenant management
│   │   ├── user/                   # User management
│   │   ├── crm/                    # Customer relationship management
│   │   ├── inventory/              # Stock and warehouse management
│   │   ├── finance/                # Accounting and billing
│   │   ├── hr/                     # Human resources
│   │   ├── projects/               # Project management
│   │   └── reports/                # Business intelligence
│   ├── shared/                     # Application-wide shared code
│   │   ├── decorators/             # Custom decorators
│   │   ├── filters/                # Exception filters
│   │   ├── guards/                 # Global guards
│   │   ├── interceptors/           # Request/response interceptors
│   │   ├── middleware/             # Custom middleware
│   │   ├── pipes/                  # Validation pipes
│   │   └── utils/                  # Utility functions
│   ├── config/                     # Configuration management
│   │   ├── database.config.ts      # Database configuration
│   │   ├── redis.config.ts         # Cache configuration
│   │   ├── jwt.config.ts           # JWT configuration
│   │   └── app.config.ts           # Application configuration
│   └── main.ts                     # Application bootstrap
├── test/                           # End-to-end tests
│   ├── auth.e2e-spec.ts
│   ├── tenant.e2e-spec.ts
│   └── jest-e2e.json
├── nest-cli.json                   # NestJS CLI configuration
├── tsconfig.json                   # TypeScript configuration
└── package.json                    # Dependencies and scripts
```

**Key Features**:
- **Modular Architecture**: Each business domain is a separate module
- **Multi-tenant Middleware**: Automatic tenant context injection
- **RBAC Guards**: Role-based access control at route level
- **API Documentation**: Auto-generated Swagger/OpenAPI docs
- **Validation**: Class-validator for request validation
- **Caching**: Redis integration for performance
- **Audit Logging**: Comprehensive activity tracking

### Frontend Web App (`apps/web/`)
**Purpose**: React-based web application with Next.js and modern UI

```
apps/web/
├── src/
│   ├── app/                        # Next.js 13+ app directory
│   │   ├── (auth)/                 # Authentication routes
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/            # Protected dashboard routes
│   │   │   ├── crm/
│   │   │   ├── inventory/
│   │   │   ├── finance/
│   │   │   ├── hr/
│   │   │   ├── projects/
│   │   │   └── reports/
│   │   ├── api/                    # API routes (if needed)
│   │   ├── globals.css             # Global styles
│   │   ├── layout.tsx              # Root layout
│   │   └── page.tsx                # Home page
│   ├── components/                 # Reusable UI components
│   │   ├── ui/                     # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...
│   │   ├── forms/                  # Form components
│   │   ├── tables/                 # Data table components
│   │   ├── charts/                 # Chart components
│   │   └── layout/                 # Layout components
│   ├── lib/                        # Utilities and configurations
│   │   ├── api.ts                  # API client configuration
│   │   ├── auth.ts                 # Authentication utilities
│   │   ├── utils.ts                # General utilities
│   │   └── validations.ts          # Form validation schemas
│   ├── hooks/                      # Custom React hooks
│   │   ├── use-auth.ts
│   │   ├── use-tenant.ts
│   │   └── use-api.ts
│   ├── store/                      # State management (Zustand)
│   │   ├── auth-store.ts
│   │   ├── tenant-store.ts
│   │   └── ui-store.ts
│   └── types/                      # Frontend-specific types
├── public/                         # Static assets
├── tailwind.config.js              # Tailwind CSS configuration
├── next.config.js                  # Next.js configuration
└── package.json                    # Dependencies and scripts
```

**Key Features**:
- **Modern React**: Next.js 13+ with app directory
- **Type Safety**: Full TypeScript integration
- **UI Components**: shadcn/ui component library
- **State Management**: Zustand for client state
- **Data Fetching**: TanStack Query for server state
- **Forms**: React Hook Form with Zod validation
- **Responsive Design**: Tailwind CSS with mobile-first approach

---

## 📚 Libraries (`libs/`)

### Shared Library (`libs/shared/`)
**Purpose**: Common types, utilities, and constants shared across applications

```
libs/shared/
├── src/
│   ├── types/                      # TypeScript type definitions
│   │   ├── index.ts                # Core entity types
│   │   ├── api.ts                  # API-related types
│   │   ├── auth.ts                 # Authentication types
│   │   └── modules/                # Module-specific types
│   ├── dtos/                       # Data Transfer Objects
│   │   ├── auth.dto.ts
│   │   ├── user.dto.ts
│   │   ├── tenant.dto.ts
│   │   └── ...
│   ├── enums/                      # Shared enumerations
│   │   ├── user-status.enum.ts
│   │   ├── subscription-status.enum.ts
│   │   └── ...
│   ├── constants/                  # Application constants
│   │   ├── index.ts                # Main constants
│   │   ├── permissions.ts          # Permission definitions
│   │   └── error-codes.ts          # Error code definitions
│   ├── utils/                      # Utility functions
│   │   ├── validation.ts           # Validation helpers
│   │   ├── formatting.ts           # Data formatting
│   │   ├── encryption.ts           # Encryption utilities
│   │   └── date.ts                 # Date utilities
│   └── index.ts                    # Main export file
├── tsconfig.json                   # TypeScript configuration
└── package.json                    # Dependencies
```

### Database Library (`libs/database/`)
**Purpose**: Database entities, migrations, and configurations

```
libs/database/
├── src/
│   ├── entities/                   # TypeORM entities
│   │   ├── base.entity.ts          # Base entity with common fields
│   │   ├── tenant.entity.ts        # Tenant entity
│   │   ├── user.entity.ts          # User entity
│   │   ├── organization.entity.ts  # Organization entity
│   │   └── modules/                # Module-specific entities
│   │       ├── crm/
│   │       ├── inventory/
│   │       ├── finance/
│   │       └── ...
│   ├── migrations/                 # Database migrations
│   │   ├── 1700000000000-CreateTenantTable.ts
│   │   ├── 1700000001000-CreateUserTable.ts
│   │   └── ...
│   ├── seeds/                      # Database seeders
│   │   ├── tenant.seed.ts
│   │   ├── user.seed.ts
│   │   └── run-seeds.ts
│   ├── config/                     # Database configuration
│   │   ├── database.config.ts      # Main database config
│   │   ├── migration.config.ts     # Migration configuration
│   │   └── seed.config.ts          # Seed configuration
│   └── index.ts                    # Main export file
├── tsconfig.json                   # TypeScript configuration
└── package.json                    # Dependencies
```

---

## 🐳 Docker Configuration (`docker/`)

### Development Environment
- **docker-compose.dev.yml**: Multi-service development setup
- **Dockerfile.api.dev**: API development container
- **Dockerfile.web.dev**: Web development container

### Production Environment
- **docker-compose.prod.yml**: Production-ready setup
- **Dockerfile.api.prod**: Optimized API production image
- **Dockerfile.web.prod**: Optimized web production image

**Key Features**:
- **Hot Reload**: Development containers support hot reloading
- **Multi-stage Builds**: Optimized production images
- **Health Checks**: Container health monitoring
- **Volume Mounts**: Persistent data and development volumes
- **Network Isolation**: Secure container networking

---

## 🏗️ Infrastructure (`infrastructure/`)

### Terraform (`infrastructure/terraform/`)
Infrastructure as Code for cloud deployment

```
infrastructure/terraform/
├── environments/
│   ├── dev/
│   ├── staging/
│   └── prod/
├── modules/
│   ├── vpc/
│   ├── rds/
│   ├── ecs/
│   └── redis/
└── variables.tf
```

### Kubernetes (`infrastructure/kubernetes/`)
Container orchestration manifests

```
infrastructure/kubernetes/
├── base/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   └── secret.yaml
├── api/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml
└── web/
    ├── deployment.yaml
    ├── service.yaml
    └── ingress.yaml
```

---

## 🔧 Build System & Tooling

### Turbo Configuration (`turbo.json`)
- **Pipeline Definition**: Build, test, lint task orchestration
- **Caching Strategy**: Intelligent build caching
- **Dependency Management**: Task dependency resolution
- **Parallel Execution**: Optimized task execution

### Package Management (`package.json`)
- **Workspace Configuration**: npm workspaces setup
- **Script Orchestration**: Cross-package script execution
- **Dependency Management**: Shared and package-specific dependencies
- **Development Tools**: Linting, formatting, testing tools

---

## 🚀 Deployment Strategy

### Development
1. **Local Development**: Docker Compose with hot reload
2. **Feature Branches**: Automated testing and preview deployments
3. **Integration Testing**: Full stack testing in containerized environment

### Production
1. **Container Registry**: Docker images pushed to registry
2. **Orchestration**: Kubernetes or ECS deployment
3. **Database Migrations**: Automated migration execution
4. **Health Checks**: Application and infrastructure monitoring
5. **Rollback Strategy**: Blue-green or rolling deployments

This architecture supports the evolution from monolith to microservices by maintaining clear module boundaries and shared libraries that can be extracted into independent services as the system scales.