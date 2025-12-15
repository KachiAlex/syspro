# Platform Seed Instructions

## Quick Method: Seed via Postman/Insomnia/Thunder Client

Since you're on Windows PowerShell and curl doesn't work well, use these methods:

### Method 1: Using Postman (Recommended)

1. **Download Postman** (if you don't have it):
   - Visit: https://www.postman.com/downloads/
   - Or use the web version: https://web.postman.com/

2. **Create a New Request:**
   - Method: `POST`
   - URL: `https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/api/platform/seed`
   - No headers or body needed

3. **Click "Send"**

4. **You should see:**
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

### Method 2: Using Browser + Vercel Bypass

If you see "Authentication Required":

1. **Get Vercel Bypass Token:**
   - Go to: https://vercel.com/onyedikachi-akomas-projects/syspro/settings/deployment-protection
   - Copy your "Protection Bypass for Automation" token

2. **Access with bypass:**
   - Open browser
   - Navigate to:
     ```
     https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/api/platform/seed?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=YOUR_TOKEN_HERE
     ```
   - Replace `YOUR_TOKEN_HERE` with the token from step 1

### Method 3: Via Vercel Dashboard Function Logs

1. Go to: https://vercel.com/onyedikachi-akomas-projects/syspro
2. Click on **Deployments**
3. Click on the latest deployment
4. Click on **Functions**
5. Find `api/platform/seed`
6. You can trigger it manually or check if it's been called

### Method 4: Using VS Code REST Client Extension

If you use VS Code:

1. Install "REST Client" extension
2. Create a file `test.http`:
   ```http
   POST https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/api/platform/seed
   ```
3. Click "Send Request" above the URL

---

## What Gets Created?

When you run the seed:

### 1. Subscription Plans
- ✅ Free Plan ($0/month)
- ✅ Starter Plan ($29/month)
- ✅ Professional Plan ($99/month)
- ✅ Enterprise Plan ($999/year)

### 2. Platform Organization
- ✅ Name: Syspro Platform
- ✅ Code: PLATFORM

### 3. Platform Tenant
- ✅ Name: Platform Administration
- ✅ Code: PLATFORM
- ✅ Subscription: Enterprise (complimentary)

### 4. Super Admin User
- ✅ Email: admin@syspro.com
- ✅ Password: Admin@123
- ✅ Role: SUPER_ADMIN
- ✅ Access: Platform tenant

### 5. Demo Organization & Tenant
- ✅ Organization: Demo Company
- ✅ Tenant: Demo Company Tenant
- ✅ Subscription: Starter (30-day trial)

---

## After Seeding

1. **Login to the platform:**
   ```
   https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/login
   
   Email: admin@syspro.com
   Password: Admin@123
   ```

2. **Change the password immediately!**

3. **Test the tenant management:**
   - Go to: https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/api/docs
   - Use the Swagger UI to test endpoints

---

## Troubleshooting

### "Authentication Required" Error
- Vercel deployment protection is enabled
- Use Method 2 above with bypass token
- Or temporarily disable protection in Vercel dashboard

### "Seed failed" Response
- Check if seed has already been run (it's idempotent)
- Check Vercel function logs for detailed error
- Ensure database connection is working

### Can't Access API Docs
- Ensure the URL is correct
- The docs are at: `/api/docs` (not `/api-docs`)

---

## Alternative: Disable Deployment Protection (Temporary)

1. Go to: https://vercel.com/onyedikachi-akomas-projects/syspro/settings/deployment-protection
2. Set to "No Protection" temporarily
3. Run the seed endpoint
4. Re-enable protection after seeding

