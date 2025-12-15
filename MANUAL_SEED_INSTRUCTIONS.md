# Manual Seed Instructions - Create Admin Account

Since automated seeding has Vercel authentication issues, here are **simple manual steps**:

---

## ✅ **Method 1: Use Postman (EASIEST)**

1. **Download/Open Postman:**
   - Download: https://www.postman.com/downloads/
   - Or use web version: https://web.postman.com/

2. **Create Request:**
   - Click **"New"** → **"HTTP Request"**
   - Set **Method:** `POST`
   - Set **URL:** 
     ```
     https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/api/platform/seed
     ```
   - Click **"Send"** button

3. **Expected Result:**
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

4. **Login:**
   - Go to: https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/login
   - Email: `admin@syspro.com`
   - Password: `Admin@123`
   - **CHANGE PASSWORD IMMEDIATELY!**

---

## ✅ **Method 2: Browser + Vercel (If Postman doesn't work)**

### Step 1: Get Vercel Bypass Token

1. Go to: **https://vercel.com/dashboard**
2. Navigate to your **syspro** project
3. Go to **Settings** → **Deployment Protection**
4. Find **"Protection Bypass for Automation"**
5. Click **"Create Token"** or copy existing token
6. **SAVE THIS TOKEN** (e.g., `AbCdEf123...`)

### Step 2: Access Seed Endpoint with Token

Open your browser and visit:
```
https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/api/platform/seed?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=YOUR_TOKEN_HERE
```

**Replace `YOUR_TOKEN_HERE`** with the token from Step 1.

### Step 3: Login

If you see success message:
- Go to: https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/login
- Email: `admin@syspro.com`
- Password: `Admin@123`

---

## ✅ **Method 3: Disable Protection Temporarily (FASTEST)**

### Step 1: Disable Protection

1. Go to: https://vercel.com/onyedikachi-akomas-projects/syspro/settings/deployment-protection
2. Change setting to **"No Protection"**
3. Click **"Save"**

### Step 2: Run Seed

**Using Postman:**
- Method: POST
- URL: `https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/api/platform/seed`
- Click Send

**OR Using Browser:**
- Just visit: `https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/api/platform/seed`

### Step 3: Re-enable Protection

1. Go back to: https://vercel.com/onyedikachi-akomas-projects/syspro/settings/deployment-protection
2. Change back to **"Standard Protection"** or your preference
3. Click **"Save"**

### Step 4: Login

- Go to: https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/login
- Email: `admin@syspro.com`
- Password: `Admin@123`

---

## 🎯 What Gets Created?

When seed runs successfully:

### ✅ Subscription Plans
1. **Free** - $0/month, 5 users
2. **Starter** - $29/month, 25 users
3. **Professional** - $99/month, 100 users
4. **Enterprise** - $999/year, unlimited users

### ✅ Organizations
1. **Syspro Platform (PLATFORM)** - Admin org
2. **Demo Company (DEMO)** - Test org

### ✅ Tenants
1. **Platform Administration** - For super admin
2. **Demo Company Tenant** - For testing

### ✅ Users
1. **Super Admin**
   - Email: admin@syspro.com
   - Password: Admin@123
   - Role: SUPER_ADMIN

---

## 🔐 After Login

### 1. Change Password Immediately

**Via API:**
```
PATCH /api/users/me/password
Headers: {
  "Authorization": "Bearer YOUR_ACCESS_TOKEN"
}
Body: {
  "currentPassword": "Admin@123",
  "newPassword": "YourNewSecurePassword123!"
}
```

**Via Dashboard:** (when implemented)
- Go to Profile → Security → Change Password

### 2. Explore Available Endpoints

Visit API Documentation:
```
https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/api/docs
```

### 3. Create Your First Tenant

**Using Swagger UI at `/api/docs`:**

1. **Authenticate:**
   - Click "Authorize" button
   - Enter: `Bearer YOUR_ACCESS_TOKEN`

2. **Create Organization:**
   - POST `/api/organizations`
   - Body:
     ```json
     {
       "name": "My Company",
       "code": "MYCO",
       "email": "contact@mycompany.com",
       "phone": "+1234567890",
       "address": "123 Main St",
       "city": "New York",
       "country": "USA"
     }
     ```

3. **Create Tenant:**
   - POST `/api/tenants`
   - Body:
     ```json
     {
       "name": "My Company Tenant",
       "code": "MYCO",
       "organizationId": "<org-id-from-step-2>",
       "settings": {
         "timezone": "America/New_York",
         "currency": "USD",
         "dateFormat": "MM/DD/YYYY"
       }
     }
     ```

---

## ❓ Troubleshooting

### Seed Returns "Already Exists"
✅ **This is GOOD!** It means the seed has already run. Just login with:
- Email: `admin@syspro.com`
- Password: `Admin@123`

### "Authentication Required" Error
- Use Method 2 or 3 above (bypass token or disable protection)
- Vercel deployment protection is enabled

### "Database Connection Error"
1. Check Vercel environment variables:
   - Go to: https://vercel.com/onyedikachi-akomas-projects/syspro/settings/environment-variables
   - Ensure `POSTGRES_URL` is set
2. Check Neon database is running:
   - Go to: https://console.neon.tech/
   - Verify database is active

### Can't Login After Seed
1. Verify seed was successful (check response)
2. Try forgot password flow
3. Check Vercel function logs for errors

---

## 📞 Quick Links

- **Login:** https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/login
- **API Docs:** https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/api/docs
- **Vercel Dashboard:** https://vercel.com/onyedikachi-akomas-projects/syspro
- **Neon Console:** https://console.neon.tech/
- **GitHub Repo:** https://github.com/KachiAlex/syspro

---

## ✅ Success Checklist

- [ ] Run seed endpoint (Method 1, 2, or 3)
- [ ] Verify success response
- [ ] Login with admin credentials
- [ ] Change admin password
- [ ] Explore API documentation
- [ ] Create test tenant (optional)
- [ ] Review ADMIN_SETUP_GUIDE.md for advanced features

---

**Need more help?** See `ADMIN_SETUP_GUIDE.md` for comprehensive documentation.

