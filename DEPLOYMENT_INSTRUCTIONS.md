# 🚀 Production Deployment Instructions - Syspro ERP

**Status**: ✅ READY FOR PRODUCTION

**Module Registry System**: Fully Implemented & Tested

---

## Quick Start

### For Windows Users
```powershell
.\scripts\deploy-to-production.bat
```

### For Linux/Mac Users
```bash
chmod +x scripts/deploy-to-production.sh
./scripts/deploy-to-production.sh
```

---

## Manual Deployment Steps

### Step 1: Verify Local Build

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Verify build succeeded
echo "Build completed successfully!"
```

### Step 2: Prepare Production Database

#### Option A: Using Neon (Recommended)

1. Go to [Neon Console](https://console.neon.tech)
2. Create new project: `syspro-erp-prod`
3. Copy the connection string
4. Run migrations:

```bash
# Set production database URL
$env:DATABASE_URL = "postgresql://user:password@host/syspro-prod?sslmode=require"

# Run migrations
npm run db:migrate

# Seed initial data
npm run db:seed
```

#### Option B: Using Your Own PostgreSQL

```bash
# Ensure PostgreSQL is running and accessible
# Set connection string
$env:DATABASE_URL = "postgresql://user:password@localhost:5432/syspro-prod"

# Run migrations
npm run db:migrate

# Seed initial data
npm run db:seed
```

### Step 3: Set Up Redis Cache (Optional but Recommended)

1. Go to [Upstash Console](https://console.upstash.com)
2. Create new Redis database: `syspro-erp-cache`
3. Copy the Redis URL
4. Save for Vercel environment variables

### Step 4: Deploy to Vercel

#### Method 1: Automatic Deployment (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"New Project"**
3. Select **"Import Git Repository"**
4. Choose: `KachiAlex/syspro`
5. Configure project:
   - **Framework Preset**: Other
   - **Build Command**: `npm run vercel-build`
   - **Install Command**: `npm install`
   - **Output Directory**: Leave empty
   - **Root Directory**: Leave empty

6. Click **"Deploy"**

#### Method 2: Manual Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Step 5: Configure Environment Variables in Vercel

Go to **Vercel Dashboard** → **Settings** → **Environment Variables**

Add the following variables:

#### Database Configuration
```
DATABASE_URL=postgresql://user:password@host/syspro-prod?sslmode=require
```

#### Redis Configuration (Optional)
```
REDIS_URL=redis://default:password@host:port
```

#### JWT Secrets (Generate strong 256-bit secrets!)
```
JWT_SECRET=<generate-strong-secret-here>
JWT_REFRESH_SECRET=<generate-strong-refresh-secret>
JWT_PASSWORD_RESET_SECRET=<generate-password-reset-secret>
JWT_EMAIL_VERIFICATION_SECRET=<generate-email-verification-secret>
```

#### Application Configuration
```
NODE_ENV=production
FRONTEND_URL=https://your-production-domain.com
CORS_ORIGINS=https://your-production-domain.com
THROTTLE_TTL=60
THROTTLE_LIMIT=50
ENABLE_SWAGGER=false
ENABLE_METRICS=true
```

#### Optional: Monitoring & Analytics
```
SENTRY_DSN=<your-sentry-dsn>
LOG_LEVEL=info
```

### Step 6: Verify Deployment

Once Vercel deployment completes, verify everything is working:

```bash
# Health check
curl https://your-app.vercel.app/api/v1/health

# Module registry health
curl https://your-app.vercel.app/api/v1/modules/health

# Authentication test
curl -X POST https://your-app.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: YOUR_TENANT_ID" \
  -d '{
    "email": "admin@syspro.com",
    "password": "Admin@123"
  }'
```

Expected responses:
- Health check: `{"status": "ok"}`
- Auth: JWT token in response

---

## Post-Deployment Security Checklist

### Immediate Actions (Do These First!)

- [ ] **Change Default Admin Password**
  ```bash
  curl -X PATCH https://your-app.vercel.app/api/v1/auth/change-password \
    -H "Authorization: Bearer YOUR_JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "currentPassword": "Admin@123",
      "newPassword": "YourNewSecurePassword123!"
    }'
  ```

- [ ] **Verify JWT Secrets**
  - Ensure all JWT secrets are 256-bit minimum
  - Use strong random generation
  - Store securely in Vercel

- [ ] **Enable Database SSL**
  - Verify `sslmode=require` in DATABASE_URL
  - Test SSL connection

- [ ] **Configure CORS**
  - Update CORS_ORIGINS to match your domain
  - Test cross-origin requests

### Short-term Actions (Within 24 hours)

- [ ] **Set Up Monitoring**
  - Configure Sentry for error tracking
  - Set up uptime monitoring
  - Configure log aggregation

- [ ] **Enable Rate Limiting**
  - Verify THROTTLE_LIMIT and THROTTLE_TTL
  - Test rate limiting behavior

- [ ] **Create Admin Users**
  - Create additional admin accounts
  - Disable default admin account (optional)

- [ ] **Configure Backups**
  - Set up database backups (Neon has built-in backups)
  - Test backup restoration

### Medium-term Actions (Within 1 week)

- [ ] **Set Up CI/CD Pipeline**
  - Configure GitHub Actions for automated testing
  - Set up automatic deployments on push to main

- [ ] **Create Runbooks**
  - Document common issues and solutions
  - Create incident response procedures

- [ ] **Performance Tuning**
  - Monitor database query performance
  - Optimize slow queries
  - Configure connection pooling

- [ ] **Disaster Recovery Plan**
  - Document recovery procedures
  - Test recovery process
  - Set up failover strategy

---

## Troubleshooting

### Build Failures

**Problem**: Build fails with TypeScript errors
```
Solution:
1. Check tsconfig.json is correct
2. Run npm run build locally to debug
3. Verify all dependencies are installed
4. Check for circular dependencies
```

**Problem**: Module not found errors
```
Solution:
1. Verify all imports use correct paths
2. Check @syspro/database exports
3. Ensure all packages are in package.json
4. Clear node_modules and reinstall
```

### Database Connection Issues

**Problem**: Cannot connect to database
```
Solution:
1. Verify DATABASE_URL format
2. Check database is running and accessible
3. Verify SSL certificate (if using SSL)
4. Check firewall rules allow connection
5. Test connection locally first
```

**Problem**: Migration fails
```
Solution:
1. Check migration files are valid SQL
2. Verify database user has permissions
3. Check for existing schema conflicts
4. Run migrations locally first to debug
```

### Authentication Issues

**Problem**: Login fails with 401 Unauthorized
```
Solution:
1. Verify JWT_SECRET is set correctly
2. Check token expiration settings
3. Verify user exists in database
4. Check password is correct
```

**Problem**: CORS errors
```
Solution:
1. Update CORS_ORIGINS environment variable
2. Verify frontend URL matches CORS_ORIGINS
3. Check browser console for specific error
4. Test with curl to isolate issue
```

### Performance Issues

**Problem**: Slow API responses
```
Solution:
1. Check database query performance
2. Verify caching is working (Redis)
3. Monitor database connection pool
4. Check for N+1 query problems
5. Review Vercel function logs
```

**Problem**: High memory usage
```
Solution:
1. Check for memory leaks in services
2. Verify connection pooling is configured
3. Monitor Redis memory usage
4. Review Vercel function metrics
```

---

## Monitoring & Maintenance

### Key Metrics to Monitor

- **API Response Time**: Target < 200ms
- **Error Rate**: Target < 0.1%
- **Database Connection Pool**: Monitor usage
- **Redis Memory**: Monitor cache hit rate
- **Uptime**: Target 99.9%

### Regular Maintenance Tasks

- **Daily**: Check error logs, monitor uptime
- **Weekly**: Review performance metrics, check backups
- **Monthly**: Security audit, dependency updates
- **Quarterly**: Capacity planning, disaster recovery drill

### Useful Commands

```bash
# Check deployment status
vercel status

# View logs
vercel logs

# Rollback to previous deployment
vercel rollback

# View environment variables
vercel env list

# Update environment variables
vercel env add VARIABLE_NAME
```

---

## Support & Documentation

### Key Documents

- **Deployment Guide**: `DEPLOYMENT.md`
- **Production Status**: `PRODUCTION_DEPLOYMENT_READY.md`
- **Architecture**: `ARCHITECTURE.md`
- **Requirements**: `.kiro/specs/module-registry-system/requirements.md`
- **Design**: `.kiro/specs/module-registry-system/design.md`
- **Implementation Tasks**: `.kiro/specs/module-registry-system/tasks.md`

### API Documentation

Once deployed, API documentation is available at:
- `https://your-app.vercel.app/api/docs` (if ENABLE_SWAGGER=true)

### Getting Help

1. Check the troubleshooting section above
2. Review Vercel deployment logs
3. Check database logs in Neon console
4. Review application error logs
5. Check GitHub issues for similar problems

---

## Rollback Procedure

If something goes wrong after deployment:

### Quick Rollback (Vercel)

1. Go to Vercel Dashboard
2. Select your project
3. Go to **Deployments**
4. Find the previous working deployment
5. Click **Promote to Production**

### Database Rollback

If migrations caused issues:

```bash
# Revert last migration
npm run db:migrate:revert

# Or manually run rollback script
DATABASE_URL="your-prod-url" npm run db:migrate:revert
```

### Full Rollback

1. Rollback Vercel deployment (see above)
2. Rollback database migrations
3. Verify all systems are working
4. Investigate root cause
5. Fix and redeploy

---

## Success Criteria

Your deployment is successful when:

- ✅ Health check returns `{"status": "ok"}`
- ✅ Authentication works with valid credentials
- ✅ Module registry endpoints respond correctly
- ✅ Database migrations completed successfully
- ✅ No errors in Vercel function logs
- ✅ API response times are acceptable (< 200ms)
- ✅ All environment variables are set
- ✅ SSL certificate is valid
- ✅ CORS is properly configured
- ✅ Rate limiting is working

---

## Next Steps After Deployment

1. **Monitor**: Watch logs and metrics for 24 hours
2. **Test**: Run comprehensive integration tests
3. **Optimize**: Fine-tune performance based on metrics
4. **Document**: Update runbooks with any learnings
5. **Plan**: Schedule next features and improvements

---

**Deployment Date**: Ready for immediate deployment
**Last Updated**: January 3, 2026
**Status**: ✅ PRODUCTION READY

🎉 **Your Syspro ERP system is ready for production!**
