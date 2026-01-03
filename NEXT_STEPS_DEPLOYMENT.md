# 🚀 Next Steps - Production Deployment

**Status**: ✅ READY FOR DEPLOYMENT

**Date**: January 3, 2026

---

## Step 1: Prepare Production Environment Variables

### Create `.env.production` file with these variables:

```env
# Database Configuration
DATABASE_URL=postgresql://user:password@host/syspro-prod?sslmode=require

# Redis Cache (Optional but Recommended)
REDIS_URL=redis://default:password@host:port

# JWT Secrets (Generate strong 256-bit secrets!)
JWT_SECRET=<generate-strong-secret-here>
JWT_REFRESH_SECRET=<generate-strong-refresh-secret>
JWT_PASSWORD_RESET_SECRET=<generate-password-reset-secret>
JWT_EMAIL_VERIFICATION_SECRET=<generate-email-verification-secret>

# Application Configuration
NODE_ENV=production
FRONTEND_URL=https://your-production-domain.com
CORS_ORIGINS=https://your-production-domain.com
THROTTLE_TTL=60
THROTTLE_LIMIT=50
ENABLE_SWAGGER=false
ENABLE_METRICS=true

# Optional: Error Tracking
SENTRY_DSN=<your-sentry-dsn>
LOG_LEVEL=info
```

---

## Step 2: Set Up Production Database

### Option A: Using Neon (Recommended)

1. **Create Neon Database**:
   - Go to [Neon Console](https://console.neon.tech)
   - Create new project: `syspro-erp-prod`
   - Copy the connection string
   - Add to `DATABASE_URL` environment variable

2. **Run Migrations**:
   ```bash
   # Set production database URL
   $env:DATABASE_URL = "postgresql://user:password@host/syspro-prod?sslmode=require"
   
   # Run migrations
   npm run db:migrate
   
   # Seed initial data
   npm run db:seed
   ```

### Option B: Using Your Own PostgreSQL

1. **Ensure PostgreSQL is running**
2. **Create database**: `syspro-prod`
3. **Run migrations**:
   ```bash
   $env:DATABASE_URL = "postgresql://user:password@localhost:5432/syspro-prod"
   npm run db:migrate
   npm run db:seed
   ```

---

## Step 3: Set Up Redis Cache (Optional)

### Using Upstash (Recommended)

1. **Create Redis Database**:
   - Go to [Upstash Console](https://console.upstash.com)
   - Create new Redis database: `syspro-erp-cache`
   - Copy the Redis URL
   - Add to `REDIS_URL` environment variable

---

## Step 4: Deploy to Vercel

### Method 1: Automatic Deployment (Recommended)

1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**
2. **Click "New Project"**
3. **Select "Import Git Repository"**
4. **Choose**: `KachiAlex/syspro`
5. **Configure Project**:
   - **Framework Preset**: Other
   - **Build Command**: `npm run vercel-build`
   - **Install Command**: `npm install`
   - **Output Directory**: Leave empty
   - **Root Directory**: Leave empty

6. **Add Environment Variables**:
   - Go to **Settings** → **Environment Variables**
   - Add all variables from Step 1
   - Make sure to add them for Production environment

7. **Click "Deploy"**
8. **Wait for build to complete** (typically 5-10 minutes)

### Method 2: Using Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to production
vercel --prod
```

---

## Step 5: Verify Deployment

### Health Check
```bash
curl https://your-app.vercel.app/api/v1/health
```

Expected response:
```json
{"status": "ok"}
```

### Module Registry Health
```bash
curl https://your-app.vercel.app/api/v1/modules/health
```

### Authentication Test
```bash
curl -X POST https://your-app.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: YOUR_TENANT_ID" \
  -d '{
    "email": "admin@syspro.com",
    "password": "Admin@123"
  }'
```

Expected response: JWT token in response body

---

## Step 6: Post-Deployment Security Actions

### Immediate Actions (Do These First!)

1. **Change Default Admin Password**:
   ```bash
   curl -X PATCH https://your-app.vercel.app/api/v1/auth/change-password \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "currentPassword": "Admin@123",
       "newPassword": "YourNewSecurePassword123!"
     }'
   ```

2. **Verify JWT Secrets**:
   - Ensure all JWT secrets are 256-bit minimum
   - Use strong random generation
   - Store securely in Vercel

3. **Enable Database SSL**:
   - Verify `sslmode=require` in DATABASE_URL
   - Test SSL connection

4. **Configure CORS**:
   - Update CORS_ORIGINS to match your domain
   - Test cross-origin requests

### Short-term Actions (Within 24 hours)

1. **Set Up Error Tracking**:
   - Configure Sentry for error tracking
   - Set up uptime monitoring
   - Configure log aggregation

2. **Enable Rate Limiting**:
   - Verify THROTTLE_LIMIT and THROTTLE_TTL
   - Test rate limiting behavior

3. **Create Additional Admin Users**:
   - Create additional admin accounts
   - Disable default admin account (optional)

4. **Configure Backups**:
   - Set up database backups (Neon has built-in backups)
   - Test backup restoration

---

## Step 7: Set Up Monitoring

### Recommended Tools

1. **Error Tracking**: [Sentry](https://sentry.io)
   - Set `SENTRY_DSN` environment variable
   - Monitor errors in real-time

2. **Uptime Monitoring**: [UptimeRobot](https://uptimerobot.com)
   - Monitor health endpoint
   - Get alerts on downtime

3. **Performance Monitoring**: [New Relic](https://newrelic.com)
   - Monitor API response times
   - Track database performance

4. **Log Aggregation**: [LogRocket](https://logrocket.com)
   - Aggregate application logs
   - Debug issues in production

---

## Step 8: Configure CI/CD Pipeline

### GitHub Actions Setup

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: vercel/action@master
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## Step 9: Create Runbooks

### Common Issues & Solutions

**API Returns 500 Error**
1. Check Vercel function logs
2. Check database connection
3. Review error tracking (Sentry)
4. Check environment variables

**Database Connection Fails**
1. Verify DATABASE_URL format
2. Check database is running
3. Verify SSL certificate
4. Check firewall rules

**Authentication Issues**
1. Verify JWT_SECRET is set
2. Check token expiration
3. Verify user exists in database
4. Check password is correct

**Performance Issues**
1. Check database query performance
2. Verify caching is working
3. Monitor connection pool usage
4. Review Vercel function metrics

---

## Step 10: Plan for Scaling

### Database Scaling
- Monitor connection pool usage
- Consider read replicas for Neon
- Optimize slow queries

### Cache Scaling
- Monitor Redis memory usage
- Consider Upstash scaling options
- Optimize cache hit rate

### API Scaling
- Monitor Vercel function metrics
- Consider upgrading Vercel plan
- Optimize function performance

---

## Deployment Checklist

### Pre-Deployment
- [ ] All code committed to main branch
- [ ] Working tree clean
- [ ] All 16 tasks completed
- [ ] Integration tests passing
- [ ] Error handling comprehensive
- [ ] Database migrations ready
- [ ] Module configuration complete

### Deployment
- [ ] Set up production database (Neon)
- [ ] Set up Redis cache (Upstash)
- [ ] Generate JWT secrets
- [ ] Set environment variables in Vercel
- [ ] Deploy to Vercel
- [ ] Verify health check
- [ ] Test authentication

### Post-Deployment
- [ ] Change default admin password
- [ ] Set up error tracking (Sentry)
- [ ] Configure backups
- [ ] Enable rate limiting
- [ ] Set up CI/CD pipeline
- [ ] Create runbooks
- [ ] Set up monitoring

---

## Troubleshooting

### Build Fails
```bash
# Clear cache and reinstall
Remove-Item -Recurse -Force node_modules
npm install
npm run build
```

### Database Connection Issues
```bash
# Test connection locally first
$env:DATABASE_URL = "your-url"
npm run db:migrate
```

### Deployment Rollback
```bash
# Rollback to previous version
vercel rollback
```

---

## Support & Documentation

- **Deployment Guide**: `DEPLOYMENT_INSTRUCTIONS.md`
- **Quick Reference**: `QUICK_DEPLOY_REFERENCE.md`
- **Specification**: `.kiro/specs/module-registry-system/`
- **Architecture**: `ARCHITECTURE.md`

---

## Success Criteria

Your deployment is successful when:

✅ Health check returns `{"status": "ok"}`
✅ Authentication works with valid credentials
✅ Module registry endpoints respond correctly
✅ Database migrations completed successfully
✅ No errors in Vercel function logs
✅ API response times < 200ms
✅ All environment variables set
✅ SSL certificate valid
✅ CORS properly configured
✅ Rate limiting working

---

## Timeline

- **Immediate**: Set up environment variables (15 minutes)
- **Short-term**: Deploy to Vercel (10-15 minutes)
- **Medium-term**: Set up monitoring (30 minutes)
- **Long-term**: Plan for scaling (ongoing)

---

**Status**: ✅ READY FOR DEPLOYMENT

**Next Action**: Follow Step 1 to prepare environment variables

🚀 **Let's deploy!**
