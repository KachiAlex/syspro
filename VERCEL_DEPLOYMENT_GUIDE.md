# Syspro ERP - Vercel Deployment Guide

## 🚀 Quick Deployment Steps

Since you already have Vercel project and Neon PostgreSQL set up, follow these steps:

### Step 1: Database Setup

1. **Run the Database Script**:
   - Go to your Neon Console
   - Open SQL Editor
   - Copy and paste the content from `deploy-database.sql`
   - Execute the script
   - Note the Platform Tenant ID from the output

### Step 2: Environment Variables Setup

In your Vercel project dashboard, go to Settings → Environment Variables and add:

#### Required Variables:
```env
# Database
DATABASE_URL=your_neon_connection_string_here

# JWT Secrets (generate strong 256-bit secrets)
JWT_SECRET=your-super-secure-jwt-secret-256-bits
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-256-bits
JWT_PASSWORD_RESET_SECRET=your-password-reset-secret-256-bits
JWT_EMAIL_VERIFICATION_SECRET=your-email-verification-secret-256-bits

# App Configuration
NODE_ENV=production
FRONTEND_URL=https://your-vercel-app.vercel.app
CORS_ORIGINS=https://your-vercel-app.vercel.app,https://*.vercel.app

# API Configuration
API_PORT=3000

# Security & Performance
THROTTLE_TTL=60
THROTTLE_LIMIT=50
DB_MAX_CONNECTIONS=5
DB_CONNECTION_TIMEOUT=30000
DB_IDLE_TIMEOUT=10000

# Features
ENABLE_SWAGGER=false
ENABLE_METRICS=true
MAINTENANCE_MODE=false
```

#### Optional (for enhanced performance):
```env
# Redis (if you want caching)
REDIS_URL=your_upstash_redis_url

# Cache Settings
REDIS_DEFAULT_TTL=180
REDIS_SESSION_TTL=3600
REDIS_CACHE_TTL=900
```

### Step 3: Deploy to Vercel

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "feat: production-ready Syspro ERP system"
   git push origin main
   ```

2. **Vercel will automatically deploy** from your connected repository

3. **Check deployment logs** in Vercel dashboard

### Step 4: Get Your Tenant ID

After database setup, you need to get the actual tenant ID:

1. **Query your database**:
   ```sql
   SELECT id, name, code FROM tenants WHERE code = 'PLATFORM';
   ```

2. **Copy the tenant ID** - you'll need this for login

### Step 5: Test Your Deployment

1. **Visit your Vercel URL**
2. **Check API health**: `https://your-app.vercel.app/api/v1/health`
3. **Test login with**:
   - Email: `admin@syspro.com`
   - Password: `Admin@123`
   - Tenant ID: `[the UUID from Step 4]`

## 🔧 Troubleshooting

### Common Issues:

1. **Function Timeout**:
   - Check Vercel function logs
   - Ensure database connection string is correct
   - Verify environment variables are set

2. **Database Connection**:
   - Ensure Neon database is active
   - Check connection string format
   - Verify SSL settings

3. **CORS Issues**:
   - Update `CORS_ORIGINS` environment variable
   - Ensure frontend URL matches Vercel deployment

4. **Authentication Issues**:
   - Verify JWT secrets are set
   - Check tenant ID is correct UUID format
   - Ensure database has admin user

### Debug Commands:

```bash
# Check API health
curl https://your-app.vercel.app/api/v1/health

# Test login (replace with your tenant ID)
curl -X POST https://your-app.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: your-tenant-id-here" \
  -d '{
    "email": "admin@syspro.com",
    "password": "Admin@123"
  }'
```

## 🎯 Post-Deployment Checklist

- [ ] Database script executed successfully
- [ ] All environment variables set in Vercel
- [ ] API health check returns 200
- [ ] Login works with admin credentials
- [ ] Dashboard loads after login
- [ ] No console errors in browser
- [ ] API endpoints respond correctly

## 🔐 Security Notes

1. **Change default admin password** immediately after first login
2. **Use strong JWT secrets** (256-bit recommended)
3. **Enable HTTPS only** in production
4. **Set up monitoring** and alerts
5. **Regular security updates**

---

Your Syspro ERP system should now be live! 🚀