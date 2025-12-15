# Billing Admin UI

Production-ready admin dashboard for managing billing, subscriptions, invoices, and reporting.

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn UI
- React Router
- React Query (TanStack Query)
- React Hook Form + Zod
- Recharts for charts

## Getting Started

```bash
cd billing-admin-ui
npm install
npm run dev
```

The app will be available at http://localhost:3001

## Features

- **Dashboard**: KPIs (MRR, ARR, Outstanding AR, Churn, etc.)
- **Plans Management**: Create, edit, and manage subscription plans
- **Tenant Billing**: View tenant subscriptions and invoices
- **Invoice Management**: View, download PDFs, resend, refund
- **Metering Console**: View and record usage events
- **Reports**: AR aging, revenue reports, export to CSV
- **Settings**: Configure billing policies, retry schedules, templates

## API Integration

The UI expects the following API endpoints:

- `/api/billing/plans` - Plans CRUD
- `/api/billing/subscription` - Subscription management
- `/api/billing/invoices` - Invoice management
- `/api/billing/tenants` - Tenant listing
- `/api/billing/reports/*` - Reporting endpoints
- `/api/billing/metering/*` - Metering endpoints

## Environment Variables

Create `.env`:

```env
VITE_API_URL=http://localhost:4000/api
```

## Build

```bash
npm run build
```

Production build will be in `dist/` directory.

