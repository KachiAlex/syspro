# Syspro ERP - Setup Guide

## Quick Start

### Prerequisites
- Node.js 18+ installed
- Docker & Docker Compose installed
- Git installed

### Initial Setup

1. **Install root dependencies**
```bash
npm install
```

2. **Install backend dependencies**
```bash
cd backend
npm install
```

3. **Install frontend dependencies**
```bash
cd ../frontend
npm install
```

4. **Set up environment variables**

Backend:
```bash
cd ../backend
cp .env.example .env
# Edit .env with your configuration
```

Frontend:
```bash
cd ../frontend
cp .env.example .env
# Edit .env with your configuration
```

### Running with Docker (Recommended)

1. **Start all services**
```bash
docker-compose up -d
```

2. **Run database migrations** (when ready)
```bash
cd backend
npm run migration:run
```

3. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- API Documentation: http://localhost:4000/api/docs

### Running Locally (Development)

1. **Start PostgreSQL and Redis** (using Docker or locally)
```bash
docker-compose up -d postgres redis
```

2. **Start Backend**
```bash
cd backend
npm run start:dev
```

3. **Start Frontend** (in a new terminal)
```bash
cd frontend
npm start
```

## Project Structure

```
Syspro/
├── backend/                 # NestJS Backend
│   ├── src/
│   │   ├── modules/         # Feature modules
│   │   │   ├── auth/        # Authentication module
│   │   │   ├── users/       # User management
│   │   │   └── organizations/ # Organization management
│   │   ├── entities/        # Database entities
│   │   ├── common/          # Shared utilities
│   │   └── config/          # Configuration files
│   └── Dockerfile
├── frontend/                # React Frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── lib/            # Utilities
│   │   └── store/          # State management
│   └── Dockerfile
├── docker-compose.yml       # Docker orchestration
└── README.md
```

## Key Features Implemented

### Backend
✅ NestJS framework setup
✅ PostgreSQL database with TypeORM
✅ Redis caching
✅ JWT authentication (access + refresh tokens)
✅ RBAC (Role-Based Access Control)
✅ Multi-tenant architecture (row-level tenancy)
✅ Swagger API documentation
✅ Database entities: User, Organization, Subsidiary, Department

### Frontend
✅ React + TypeScript setup
✅ Tailwind CSS configuration
✅ shadcn UI components
✅ React Router for navigation
✅ Zustand for state management
✅ Axios with interceptors for API calls
✅ Authentication flow (login/logout)
✅ Protected routes
✅ Basic dashboard

## Next Steps

### To Complete the ERP System:

1. **Core Modules** (Priority)
   - [ ] HR Module (employee management, onboarding)
   - [ ] Projects & Tasks Module
   - [ ] Tickets/IT Support Module
   - [ ] Finance Module (invoicing, payments)
   - [ ] CRM Module
   - [ ] LMS Module (Learning Management System)

2. **Dashboard System**
   - [ ] CEO Dashboard (cross-organization visibility)
   - [ ] Subsidiary Dashboards
   - [ ] Department Dashboards
   - [ ] Employee Self-Service Portal

3. **Additional Features**
   - [ ] MFA (Multi-Factor Authentication) implementation
   - [ ] File upload to AWS S3
   - [ ] Email notifications
   - [ ] Reporting and analytics
   - [ ] Advanced permissions system

4. **Infrastructure**
   - [ ] Database migrations
   - [ ] CI/CD pipeline
   - [ ] AWS deployment configuration
   - [ ] Monitoring and logging

## Development Notes

- The backend uses TypeORM with automatic synchronization in development mode
- Frontend uses React 19 with TypeScript
- Authentication tokens are stored in localStorage
- Multi-tenant isolation is handled via organizationId in requests
- All API routes are prefixed with `/api`

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running: `docker-compose ps`
- Check database credentials in `.env`
- Verify DATABASE_URL format

### Frontend Not Connecting to Backend
- Check REACT_APP_API_URL in frontend `.env`
- Ensure backend is running on port 4000
- Check CORS settings in backend

### Port Conflicts
- Change ports in `docker-compose.yml` if 3000, 4000, 5432, or 6379 are in use

