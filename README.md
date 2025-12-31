# Syspro ERP - Production-Grade Multi-Tenant System

A comprehensive, enterprise-ready ERP system built with modern technologies and clean architecture principles.

## 🏗️ Architecture Overview

This monorepo implements a **modular monolith** architecture designed to evolve into microservices. It follows Domain-Driven Design (DDD) principles with clear separation of concerns.

### Technology Stack

- **Backend**: NestJS (Node.js) with TypeScript
- **Frontend**: React + Next.js + Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL with TypeORM
- **Cache**: Redis
- **Authentication**: JWT + RBAC
- **Build System**: Turbo (monorepo management)
- **Containerization**: Docker + Docker Compose

## 📁 Project Structure

```
syspro-erp-monorepo/
├── apps/                          # Applications
│   ├── api/                       # NestJS Backend API
│   │   ├── src/
│   │   │   ├── modules/           # Feature modules (CRM, Inventory, etc.)
│   │   │   ├── shared/            # Shared application logic
│   │   │   ├── config/            # Configuration
│   │   │   └── main.ts            # Application entry point
│   │   ├── test/                  # E2E tests
│   │   └── package.json
│   └── web/                       # React Frontend
│       ├── src/
│       │   ├── app/               # Next.js app directory
│       │   ├── components/        # Reusable UI components
│       │   ├── lib/               # Utilities and configurations
│       │   └── hooks/             # Custom React hooks
│       └── package.json
├── libs/                          # Shared libraries
│   ├── shared/                    # Common types, DTOs, utilities
│   │   ├── src/
│   │   │   ├── types/             # TypeScript type definitions
│   │   │   ├── dtos/              # Data Transfer Objects
│   │   │   ├── enums/             # Shared enumerations
│   │   │   ├── constants/         # Application constants
│   │   │   └── utils/             # Utility functions
│   │   └── package.json
│   └── database/                  # Database entities and migrations
│       ├── src/
│       │   ├── entities/          # TypeORM entities
│       │   ├── migrations/        # Database migrations
│       │   ├── seeds/             # Database seeders
│       │   └── config/            # Database configuration
│       └── package.json
├── docker/                        # Docker configurations
│   ├── docker-compose.dev.yml     # Development environment
│   ├── docker-compose.prod.yml    # Production environment
│   ├── Dockerfile.api.dev         # API development image
│   ├── Dockerfile.api.prod        # API production image
│   ├── Dockerfile.web.dev         # Web development image
│   └── Dockerfile.web.prod        # Web production image
├── infrastructure/                # Infrastructure as Code
│   ├── terraform/                 # Terraform configurations
│   ├── kubernetes/                # K8s manifests
│   └── helm/                      # Helm charts
├── docs/                          # Documentation
│   ├── api/                       # API documentation
│   ├── architecture/              # Architecture decisions
│   └── deployment/                # Deployment guides
├── scripts/                       # Utility scripts
│   ├── setup.sh                   # Environment setup
│   ├── migrate.sh                 # Database migration
│   └── deploy.sh                  # Deployment script
├── .github/                       # GitHub workflows
│   └── workflows/                 # CI/CD pipelines
├── package.json                   # Root package.json (workspace config)
├── turbo.json                     # Turbo configuration
├── .gitignore                     # Git ignore rules
└── README.md                      # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git

### Development Setup

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd syspro-erp-monorepo
   npm install
   ```

2. **Start development environment**:
   ```bash
   npm run docker:dev
   ```

3. **Access applications**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - API Documentation: http://localhost:3001/api/docs

### Available Scripts

```bash
# Development
npm run dev              # Start all apps in development mode
npm run docker:dev       # Start with Docker Compose

# Building
npm run build            # Build all packages and apps
npm run type-check       # Type checking across workspace

# Testing
npm run test             # Run all tests
npm run test:e2e         # Run end-to-end tests

# Database
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed database with initial data

# Code Quality
npm run lint             # Lint all packages
npm run format           # Format code with Prettier
```

## 🏢 Multi-Tenant Architecture

### Tenant Isolation Strategies

1. **Database Level**: Separate schemas per tenant
2. **Application Level**: Tenant context in all operations
3. **API Level**: Tenant-aware routing and middleware
4. **UI Level**: Tenant-specific branding and features

### Security Features

- **Authentication**: JWT-based with refresh tokens
- **Authorization**: Role-Based Access Control (RBAC)
- **Multi-tenancy**: Secure tenant isolation
- **API Security**: Rate limiting, CORS, helmet
- **Data Encryption**: At rest and in transit

## 📊 ERP Modules

The system is designed with the following core modules:

- **CRM**: Customer relationship management
- **Inventory**: Stock and warehouse management
- **Finance**: Accounting and financial reporting
- **HR**: Human resources management
- **Projects**: Project and task management
- **Reports**: Business intelligence and analytics
- **Settings**: System configuration and tenant management

## 🔧 Configuration

### Environment Variables

Create `.env` files in respective applications:

**Backend (`apps/api/.env`)**:
```env
NODE_ENV=development
DATABASE_URL=postgresql://syspro_user:syspro_password@localhost:5432/syspro_erp_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h
API_PORT=3001
```

**Frontend (`apps/web/.env.local`)**:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000
```

## 🚢 Deployment

### Production Deployment

```bash
# Build for production
npm run build

# Start production containers
npm run docker:prod
```

### Infrastructure

The system supports deployment on:
- **Cloud Providers**: AWS, GCP, Azure
- **Container Orchestration**: Kubernetes, Docker Swarm
- **Serverless**: Vercel, Netlify (frontend), AWS Lambda (API)

## 📈 Scalability Considerations

### Horizontal Scaling
- Stateless API design
- Database read replicas
- Redis clustering
- CDN for static assets

### Microservices Evolution
- Module boundaries align with future service boundaries
- Shared libraries facilitate service extraction
- Event-driven architecture preparation
- API versioning strategy

## 🤝 Contributing

1. Follow conventional commits
2. Ensure all tests pass
3. Maintain code coverage above 80%
4. Update documentation for new features

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.