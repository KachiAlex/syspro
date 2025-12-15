# Syspro ERP - Multi-Tenant Enterprise Resource Planning System

A modular, multi-tenant ERP web application for Syscomptech & Subsidiaries, modeled after Zoho One.

## Tech Stack

### Frontend
- React + TypeScript
- Tailwind CSS
- shadcn UI

### Backend
- Node.js (NestJS)
- PostgreSQL
- Redis

### Authentication
- JWT (access/refresh tokens)
- RBAC (Role-Based Access Control)
- MFA-ready

### Storage
- AWS S3

### Deployment
- Docker + docker-compose (initial)
- Ready for AWS deployment

## Architecture

- **Modular**: Each module (HR, Operations, IT, Marketing, etc.) is independently developed
- **API-first**: RESTful APIs with GraphQL support ready
- **Multi-tenant**: Row-level tenancy for data isolation
- **Scalable**: Designed for horizontal scaling

## Features

### Core Modules
- **HR Management**: Employee management, onboarding, payroll
- **Operations**: Project management, task tracking
- **IT**: Ticket system, asset management
- **Marketing**: Campaign management, lead tracking
- **LMS**: Learning Management System with employee onboarding
- **Finance**: Invoicing, payments, financial reporting
- **CRM**: Customer relationship management
- **Projects & Tasks**: Project planning and task management

### Dashboards
- **CEO Dashboard**: Central visibility across all subsidiaries
- **Subsidiary Dashboards**: Subsidiary-level metrics and KPIs
- **Department Dashboards**: Department-specific views
- **Employee Self-Service Portal**: Personal dashboard for employees

## Getting Started

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 14+
- Redis 6+

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd Syspro
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

4. Start services with Docker
```bash
npm run docker:up
```

5. Run database migrations
```bash
cd backend
npm run migration:run
```

6. Start development servers
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000

## Project Structure

```
Syspro/
├── frontend/          # React + TypeScript frontend
├── backend/           # NestJS backend
├── docker-compose.yml # Docker configuration
└── README.md
```

## Development

### Running in Development Mode
```bash
npm run dev
```

### Building for Production
```bash
npm run build
```

### Docker Commands
```bash
npm run docker:up      # Start all services
npm run docker:down    # Stop all services
npm run docker:build   # Build Docker images
```

## License

Proprietary - Syscomptech & Subsidiaries


