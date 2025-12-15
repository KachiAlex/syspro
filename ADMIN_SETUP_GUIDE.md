# Multi-Tenant Platform Admin Setup Guide

## 🎯 Overview

Your Syspro ERP platform now includes a **complete multi-tenant management system** with:

- ✅ **Tenant Management** - Create, update, and manage multiple tenants
- ✅ **Subscription Plans** - 4 tiers (Free, Starter, Professional, Enterprise)
- ✅ **Billing System** - Invoices, payments, and subscription tracking
- ✅ **Licensing** - Feature-based licensing per plan
- ✅ **Role-Based Access Control** - Super Admin, CEO, Admin, Manager, Employee

---

## 🚀 Quick Start: Initialize Platform

### Option 1: Via API Endpoint (Recommended for Production)

The platform seed endpoint is available at:

```
POST /api/platform/seed
```

**Full URL:**
```
https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/api/platform/seed
```

**To call it:**

1. **Using Browser:** Navigate to your Vercel dashboard and access the function logs, or use Postman/Insomnia to make a POST request

2. **Using curl (from terminal with bash):**
   ```bash
   curl -X POST https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/api/platform/seed
   ```

3. **Using Postman:**
   - Method: POST
   - URL: `https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/api/platform/seed`
   - No body required
   - Click "Send"

**Expected Response:**
```json
{
  "success": true,
  "message": "Platform seeded successfully",
  "credentials": {
    "email": "admin@syspro.com",
    "password": "Admin@123",
    "warning": "CHANGE THIS PASSWORD IMMEDIATELY!"
  }
}
```

### Option 2: Via Vercel Dashboard

1. Go to: https://vercel.com/dashboard
2. Select your `syspro` project
3. Navigate to **Settings** → **Deployment Protection**
4. Temporarily disable protection or get the bypass token
5. Call the seed endpoint

---

## 🔐 Super Admin Credentials

After running the seed script, you'll have:

```
Email: admin@syspro.com
Password: Admin@123
Role: SUPER_ADMIN
Tenant: Platform Administration (PLATFORM)
```

⚠️ **IMPORTANT:** Change this password immediately after first login!

---

## 📦 Subscription Plans Created

The platform comes with 4 pre-configured plans:

### 1. Free Plan
- **Price:** $0/month
- **Users:** Up to 5
- **Storage:** 1GB
- **Modules:** Basic only
- **API Calls:** 1,000/month
- **Support:** Community

### 2. Starter Plan
- **Price:** $29/month
- **Users:** Up to 25
- **Storage:** 10GB
- **Modules:** HR, Finance, Basic
- **API Calls:** 10,000/month
- **Support:** Email

### 3. Professional Plan
- **Price:** $99/month
- **Users:** Up to 100
- **Storage:** 100GB
- **Modules:** All standard modules
- **API Calls:** 100,000/month
- **Support:** Priority
- **Features:** Custom reports

### 4. Enterprise Plan
- **Price:** $999/year
- **Users:** Unlimited
- **Storage:** 1TB
- **Modules:** All modules
- **API Calls:** Unlimited
- **Support:** 24/7 Priority
- **Features:** Custom integration, dedicated account manager, 99.9% SLA

---

## 🏢 Organizations & Tenants

### Platform Organization (PLATFORM)
- **Purpose:** System administration
- **Tenant:** Platform Administration
- **Subscription:** Enterprise (complimentary)
- **Access:** Super Admin only

### Demo Organization (DEMO)
- **Purpose:** Testing and demonstration
- **Tenant:** Demo Company Tenant
- **Subscription:** Starter Plan (30-day trial)
- **Access:** Can be shared with demo users

---

## 🎛️ API Endpoints for Tenant Management

### Authentication
```
POST /api/auth/login
Body: { "email": "admin@syspro.com", "password": "Admin@123" }
```

### Tenant Management
```
GET    /api/tenants                    # List all tenants
POST   /api/tenants                    # Create new tenant (Super Admin only)
GET    /api/tenants/:id                # Get tenant details
PATCH  /api/tenants/:id                # Update tenant
DELETE /api/tenants/:id                # Delete tenant
POST   /api/tenants/switch             # Switch to different tenant
GET    /api/tenants/user/accessible    # Get accessible tenants
```

### Billing Management
```
GET    /api/billing/tenants                    # List all tenants with billing info
GET    /api/billing/tenants/:id                # Get tenant by ID
GET    /api/billing/tenants/:id/subscription   # Get tenant subscription
GET    /api/billing/tenants/:id/invoices       # Get tenant invoices
POST   /api/billing/tenants/:id/invoices       # Create manual invoice
```

### Subscription Plans
```
GET    /api/billing/plans                      # List all plans
GET    /api/billing/plans/:id                  # Get plan details
POST   /api/billing/plans                      # Create custom plan
PATCH  /api/billing/plans/:id                  # Update plan
DELETE /api/billing/plans/:id                  # Deactivate plan
```

### Reporting
```
GET    /api/billing/reporting/revenue          # Revenue reports
GET    /api/billing/reporting/mrr              # Monthly Recurring Revenue
GET    /api/billing/reporting/arr              # Annual Recurring Revenue
GET    /api/billing/reporting/churn            # Churn rate
GET    /api/billing/reporting/tenant-summary   # Tenant summary
```

---

## 👥 User Roles & Permissions

### SUPER_ADMIN
- Full platform access
- Create/manage all tenants
- Manage subscription plans
- Access all billing data
- System configuration

### CEO
- View all tenants
- Access all reports
- Manage organization settings
- Cannot create/delete tenants

### ADMIN
- Manage assigned tenant(s)
- View billing for own tenant
- Manage users within tenant
- Access tenant reports

### FINANCE
- View/manage billing
- Generate invoices
- Process payments
- Access financial reports

### MANAGER
- View tenant data
- Manage team members
- Basic reporting

### EMPLOYEE
- Access assigned modules
- View own data
- Limited permissions

---

## 🔄 Multi-Tenant Workflow

### Creating a New Tenant

1. **Login as Super Admin:**
   ```
   POST /api/auth/login
   Body: { "email": "admin@syspro.com", "password": "Admin@123" }
   ```

2. **Create Organization:**
   ```
   POST /api/organizations
   Body: {
     "name": "New Company Ltd",
     "code": "NEWCO",
     "email": "contact@newcompany.com",
     "phone": "+1234567890",
     "address": "123 Business St",
     "city": "New York",
     "country": "USA"
   }
   ```

3. **Create Tenant:**
   ```
   POST /api/tenants
   Body: {
     "name": "New Company Tenant",
     "code": "NEWCO",
     "organizationId": "<organization-id-from-step-2>",
     "settings": {
       "timezone": "America/New_York",
       "currency": "USD",
       "dateFormat": "MM/DD/YYYY"
     }
   }
   ```

4. **Assign Subscription:**
   ```
   POST /api/billing/subscriptions
   Body: {
     "tenantId": "<tenant-id-from-step-3>",
     "planSlug": "starter",
     "billingCycle": "monthly"
   }
   ```

5. **Create Tenant Admin:**
   ```
   POST /api/users
   Body: {
     "email": "admin@newcompany.com",
     "firstName": "John",
     "lastName": "Doe",
     "password": "SecurePassword123",
     "role": "ADMIN",
     "tenantId": "<tenant-id-from-step-3>"
   }
   ```

---

## 📊 Admin Dashboard UI

A dedicated **Billing Admin UI** is included at `frontend/billing-admin-ui/`:

### Features:
- 📈 Dashboard with KPIs (MRR, ARR, active subscriptions)
- 👥 Tenant list with billing status
- 💳 Subscription management
- 📄 Invoice generation and management
- 📊 Revenue reports and analytics
- ⚙️ Plan editor
- 🔍 Metering console

### To Deploy Admin UI:

The admin UI is currently in `frontend/billing-admin-ui/` but not deployed. To deploy it:

1. Update `vercel.json` to include the admin UI build
2. Or deploy separately to a subdomain like `admin.syspro.com`
3. Configure API endpoint in the admin UI

---

## 🔧 Switching Between Tenants

Users with access to multiple tenants can switch:

```
POST /api/tenants/switch
Body: { "tenantId": "<target-tenant-id>" }
Headers: { "x-tenant-id": "<current-tenant-id>" }
```

All subsequent requests should include the new tenant ID in the header:
```
x-tenant-id: <new-tenant-id>
```

---

## 🧪 Testing the Setup

### 1. Login as Super Admin
```bash
curl -X POST https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@syspro.com","password":"Admin@123"}'
```

### 2. Get All Tenants
```bash
curl https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/api/tenants \
  -H "Authorization: Bearer <access-token-from-login>"
```

### 3. Get Subscription Plans
```bash
curl https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/api/billing/plans \
  -H "Authorization: Bearer <access-token-from-login>"
```

---

## 📚 API Documentation

Full API documentation is available at:
```
https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/api/docs
```

This includes interactive Swagger documentation for all endpoints.

---

## 🔒 Security Best Practices

1. **Change default admin password immediately**
2. **Enable 2FA for admin accounts** (use `/api/users/2fa/enable`)
3. **Use strong passwords** for all users
4. **Regularly rotate JWT secrets** in environment variables
5. **Monitor access logs** for suspicious activity
6. **Restrict Super Admin access** to trusted personnel only
7. **Use HTTPS only** for all production traffic

---

## 📞 Support & Next Steps

### Immediate Actions:
1. ✅ Run seed script to create admin account
2. ✅ Login and change admin password
3. ✅ Create your first production tenant
4. ✅ Test the billing workflow
5. ✅ Deploy admin dashboard (optional)

### Future Enhancements:
- [ ] Deploy dedicated admin UI
- [ ] Configure payment gateway (Stripe/Paystack/Flutterwave)
- [ ] Set up webhook handlers for payments
- [ ] Configure email notifications
- [ ] Add custom branding per tenant
- [ ] Implement usage metering
- [ ] Set up automated backups

---

## 🎉 Congratulations!

Your multi-tenant SaaS platform is ready to manage tenants, subscriptions, and billing!

**Live URLs:**
- **Main App:** https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app
- **API Docs:** https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/api/docs
- **GitHub:** https://github.com/KachiAlex/syspro

---

**Need Help?** Check the API documentation or review the code in:
- `backend/src/modules/tenant/` - Tenant management
- `backend/src/core/billing-service/` - Billing system
- `backend/src/core/role-service/` - Role management

