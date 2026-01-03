# 🚀 Quick Deploy Reference - Syspro ERP

**Status**: ✅ PRODUCTION READY

---

## One-Command Deployment (Windows)

```powershell
.\scripts\deploy-to-production.bat
```

## One-Command Deployment (Linux/Mac)

```bash
chmod +x scripts/deploy-to-production.sh && ./scripts/deploy-to-production.sh
```

---

## Essential Commands

### Build & Test
```bash
# Install dependencies
npm install

# Build application
npm run build

# Run tests
npm run test:ci
```

### Database Setup
```bash
# Run migrations
npm run db:migrate

# Seed initial data
npm run db:seed

# Revert migrations
npm run db:migrate:revert
```

### Deployment
```bash
# Deploy to Vercel
vercel --prod

# Check deployment status
vercel status

# View logs
vercel logs

# Rollback to previous deployment
vercel rollback
```

---

## Environment Variables Checklist

### Required
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `JWT_SECRET` - JWT signing secret (256-bit)
- [ ] `JWT_REFRESH_SECRET` - Refresh token secret
- [ ] `NODE_ENV=production`

### Recommended
- [ ] `REDIS_URL` - Redis connection for caching
- [ ] `FRONTEND_URL` - Frontend application URL
- [ ] `CORS_ORIGINS` - Allowed CORS origins
- [ ] `JWT_PASSWORD_RESET_SECRET` - Password reset secret
- [ ] `JWT_EMAIL_VERIFICATION_SECRET` - Email verification secret

### Optional
- [ ] `SENTRY_DSN` - Error tracking
- [ ] `LOG_LEVEL` - Logging level (default: info)
- [ ] `ENABLE_SWAGGER` - API documentation (default: false)
- [ ] `ENABLE_METRICS` - Metrics collection (default: true)

---

## Verification Commands

### Health Check
```bash
curl https://your-app.vercel.app/api/v1/health
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

---

## Post-Deployment Security

### Change Default Password
```bash
curl -X PATCH https://your-app.vercel.app/api/v1/auth/change-password \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "Admin@123",
    "newPassword": "YourNewSecurePassword123!"
  }'
```

---

## Troubleshooting Quick Fixes

### Build Fails
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Database Connection Issues
```bash
# Test connection locally first
DATABASE_URL="your-url" npm run db:migrate
```

### Deployment Rollback
```bash
# Rollback to previous version
vercel rollback
```

---

## Key Files

| File | Purpose |
|------|---------|
| `DEPLOYMENT_INSTRUCTIONS.md` | Comprehensive deployment guide |
| `PRODUCTION_DEPLOYMENT_READY.md` | Production readiness status |
| `PRODUCTION_DEPLOYMENT_SUMMARY.md` | Executive summary |
| `DEPLOYMENT.md` | Vercel deployment guide |
| `.kiro/specs/module-registry-system/requirements.md` | Requirements |
| `.kiro/specs/module-registry-system/design.md` | Design document |
| `.kiro/specs/module-registry-system/tasks.md` | Implementation tasks |

---

## Deployment Checklist

- [ ] Run deployment script
- [ ] Set environment variables in Vercel
- [ ] Deploy to Vercel
- [ ] Verify health check
- [ ] Test authentication
- [ ] Change default password
- [ ] Set up monitoring
- [ ] Configure backups

---

## Support

**Issues?** Check `DEPLOYMENT_INSTRUCTIONS.md` troubleshooting section.

**Questions?** Review the specification files in `.kiro/specs/module-registry-system/`

---

**Status**: ✅ READY TO DEPLOY

🎉 Your Syspro ERP system is production-ready!
