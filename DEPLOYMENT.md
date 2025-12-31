# Syspro ERP - Vercel Deployment Guide

## 🚀 Quick Deploy to Vercel

### Prerequisites
1. **Neon Database** (PostgreSQL)
2. **Upstash Redis** (optional, for caching)
3. **Vercel Account**
4. **GitHub Repository**

### Step 1: Database Setup (Neon)

1. **Create Neon Database**:
   - Go to [Neon Console](https://console.neon.tech)
   - Create new project: `syspro-erp-prod`
   - Copy the connection string

2. **Run Migrations** (locally first):
   ```bash
   # Set your production database URL
   export DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
   
   # Run migrations
   npm run db:migrate
   
   # Seed initial data
   npm run db:seed
   ```

### Step 2: Redis Setup (Upstash)

1. **Create Redis Database**:
   - Go to [Upstash Console](https://console.upstash.com)
   - Create new Redis database: `syspro-erp-cache`
   - Copy the Redis URL

### Step 3: Deploy to Vercel

1. **Connect Repository**:
   ```bash
   # Push to GitHub
   git add .
   git commit -m "feat: production-ready ERP system"
   git push origin main
   ```

2. **Import to Vercel**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository
   - Configure build settings:
     - **Framework Preset**: Other
     - **Build Command**: `npm run vercel-build`
     - **Output Directory**: Leave empty
     - **Install Command**: `npm install`

3. **Environment Variables**:
   Set these in Vercel dashboard → Settings → Environment Variables:

   ```env
   # Database
   DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
   
   # Redis (optional)
   REDIS_URL=redis://default:pass@host:port
   
   # JWT Secrets (generate strong secrets!)
   JWT_SECRET=your-super-secure-jwt-secret-here
   JWT_REFRESH_SECRET=your-super-secure-refresh-secret-here
   JWT_PASSWORD_RESET_SECRET=your-password-reset-secret-here
   JWT_EMAIL_VERIFICATION_SECRET=your-email-verification-secret-here
   
   # App Configuration
   NODE_ENV=production
   FRONTEND_URL=https://your-app.vercel.app
   CORS_ORIGINS=https://your-app.vercel.app,https://*.vercel.app
   
   # Security
   THROTTLE_TTL=60
   THROTTLE_LIMIT=50
   
   # Features
   ENABLE_SWAGGER=false
   ENABLE_METRICS=true
   ```

4. **Deploy**:
   - Click "Deploy"
   - Wait for build to complete
   - Your API will be available at: `https://your-app.vercel.app/api`

### Step 4: Test Deployment

1. **Health Check**:
   ```bash
   curl https://your-app.vercel.app/api/v1/health
   ```

2. **Authentication Test**:
   ```bash
   # Login with default admin
   curl -X POST https://your-app.vercel.app/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -H "X-Tenant-ID: YOUR_TENANT_ID" \
     -d '{
       "email": "admin@syspro.com",
       "password": "Admin@123"
     }'
   ```

3. **API Documentation**:
   - Visit: `https://your-app.vercel.app/api/docs` (if enabled)

### Step 5: Post-Deployment Setup

1. **Change Default Credentials**:
   ```bash
   # Use the change password endpoint
   curl -X PATCH https://your-app.vercel.app/api/v1/auth/change-password \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "currentPassword": "Admin@123",
       "newPassword": "YourNewSecurePassword123!"
     }'
   ```

2. **Create Additional Users**:
   - Use the registration endpoint
   - Or create users via admin panel (when implemented)

3. **Configure Tenant Settings**:
   - Update tenant branding and settings
   - Set up organization structure

## 🔧 Environment Variables Reference

### Required Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `JWT_SECRET` | JWT signing secret | `your-256-bit-secret` |
| `JWT_REFRESH_SECRET` | Refresh token secret | `your-refresh-secret` |

### Optional Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | - | Redis connection for caching |
| `FRONTEND_URL` | - | Frontend application URL |
| `THROTTLE_LIMIT` | `50` | API rate limit per window |
| `ENABLE_SWAGGER` | `false` | Enable API documentation |

## 🚨 Security Checklist

- [ ] Change default admin password
- [ ] Set strong JWT secrets (256-bit minimum)
- [ ] Configure proper CORS origins
- [ ] Enable rate limiting
- [ ] Set up monitoring and alerts
- [ ] Review and update environment variables
- [ ] Enable database SSL in production
- [ ] Set up backup strategy

## 📊 Monitoring

### Health Endpoints
- **API Health**: `/api/v1/health`
- **Simple Health**: `/api/v1/health/simple`

### Logs
- Check Vercel function logs in dashboard
- Monitor database performance in Neon
- Set up error tracking (Sentry recommended)

## 🔄 Updates and Maintenance

### Deploying Updates
```bash
git add .
git commit -m "feat: your changes"
git push origin main
# Vercel auto-deploys from main branch
```

### Database Migrations
```bash
# Run migrations against production DB
DATABASE_URL="your-prod-url" npm run db:migrate
```

### Rollback Strategy
- Use Vercel's deployment history to rollback
- Keep database migration rollback scripts
- Test changes in staging environment first

## 🆘 Troubleshooting

### Common Issues

1. **Function Timeout**:
   - Optimize database queries
   - Reduce connection pool size
   - Check for long-running operations

2. **Database Connection Issues**:
   - Verify SSL configuration
   - Check connection string format
   - Monitor connection pool usage

3. **CORS Errors**:
   - Update `CORS_ORIGINS` environment variable
   - Check frontend URL configuration

4. **Authentication Issues**:
   - Verify JWT secrets are set
   - Check token expiration settings
   - Validate tenant ID headers

### Support
- Check Vercel deployment logs
- Monitor database metrics in Neon
- Review application logs for errors

---

🎉 **Your Syspro ERP system is now live on Vercel!**

Default API URL: `https://your-app.vercel.app/api`
Admin Login: `admin@syspro.com` / `Admin@123` (change immediately!)