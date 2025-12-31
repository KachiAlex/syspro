# 🚀 Deploy Syspro ERP to Vercel - Step by Step

## Prerequisites ✅
- [x] Vercel project created
- [x] Neon PostgreSQL database set up
- [x] Code ready for deployment

## Step 1: Generate Deployment Secrets

Run this command to generate secure JWT secrets:

```bash
npm run deploy:setup
```

This will generate secure secrets and create a checklist for you.

## Step 2: Set Up Database

1. **Go to your Neon Console**
2. **Open SQL Editor**
3. **Copy and paste the entire content from `deploy-database.sql`**
4. **Execute the script**
5. **Note the Platform Tenant ID from the output**

## Step 3: Configure Vercel Environment Variables

Go to your Vercel project → Settings → Environment Variables and add:

### Required Variables:
```env
DATABASE_URL=your_neon_connection_string_from_neon_console
JWT_SECRET=generated_from_step_1
JWT_REFRESH_SECRET=generated_from_step_1
JWT_PASSWORD_RESET_SECRET=generated_from_step_1
JWT_EMAIL_VERIFICATION_SECRET=generated_from_step_1
NODE_ENV=production
FRONTEND_URL=https://your-vercel-app.vercel.app
CORS_ORIGINS=https://your-vercel-app.vercel.app,https://*.vercel.app
API_PORT=3000
THROTTLE_TTL=60
THROTTLE_LIMIT=50
DB_MAX_CONNECTIONS=5
DB_CONNECTION_TIMEOUT=30000
DB_IDLE_TIMEOUT=10000
ENABLE_SWAGGER=false
ENABLE_METRICS=true
MAINTENANCE_MODE=false
```

## Step 4: Deploy to Vercel

```bash
# Commit and push your code
git add .
git commit -m "feat: production-ready Syspro ERP system"
git push origin main
```

Vercel will automatically deploy from your connected repository.

## Step 5: Get Your Tenant ID

After database setup, run this query in Neon SQL Editor:

```sql
SELECT id, name, code FROM tenants WHERE code = 'PLATFORM';
```

Copy the `id` value - this is your tenant ID for login.

## Step 6: Test Your Deployment

1. **Check API Health**:
   ```bash
   curl https://your-vercel-app.vercel.app/api/v1/health
   ```

2. **Test Login**:
   ```bash
   curl -X POST https://your-vercel-app.vercel.app/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -H "X-Tenant-ID: YOUR_TENANT_ID_FROM_STEP_5" \
     -d '{
       "email": "admin@syspro.com",
       "password": "Admin@123"
     }'
   ```

3. **Visit Your App**:
   - Go to `https://your-vercel-app.vercel.app`
   - Click "Sign In"
   - Use credentials:
     - Email: `admin@syspro.com`
     - Password: `Admin@123`
     - Tenant ID: `[from Step 5]`

## Step 7: Verify Everything Works

- [ ] Landing page loads
- [ ] API health check returns success
- [ ] Login works with admin credentials
- [ ] Dashboard loads after login
- [ ] No console errors
- [ ] All API endpoints respond

## 🎉 Success!

Your Syspro ERP system is now live! 

### Next Steps:
1. **Change admin password** in the dashboard
2. **Set up monitoring** (optional)
3. **Add more users** and organizations
4. **Customize tenant settings**
5. **Start building ERP modules**

### Support:
- Check Vercel deployment logs for any issues
- Verify all environment variables are set correctly
- Ensure database script ran successfully

---

**Your production-ready multi-tenant ERP system is now deployed! 🚀**