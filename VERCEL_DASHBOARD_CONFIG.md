# Vercel Dashboard Configuration Instructions

## 🎯 Strategy 1: Manual Dashboard Configuration

This is the **RECOMMENDED** approach for fixing Next.js routing in monorepo deployments.

### Step-by-Step Instructions:

#### 1. Access Vercel Dashboard
- Go to: https://vercel.com/dashboard
- Find your project: **syspro** (or similar name)
- Click on the project name to open project settings

#### 2. Configure Root Directory
- Navigate to: **Settings** tab
- Scroll down to: **Root Directory** section
- Current setting: `." (root directory)
- **Change to**: `apps/web`
- Click: **Save** button

#### 3. Configure Build Settings (if needed)
- In the same Settings page, find: **Build & Output Settings**
- **Build Command**: Should be `npm run build` (default is fine)
- **Output Directory**: Should be `.next` (default is fine)
- **Install Command**: Should be `npm install` (default is fine)

#### 4. Trigger Redeploy
- Navigate to: **Deployments** tab
- Find the latest deployment
- Click: **⋯** (three dots menu)
- Select: **Redeploy**
- Wait for deployment to complete

### Expected Results After Configuration:

✅ **Working Routes:**
- `/` - Main application page
- `/test` - Test page with success message
- `/login` - Login form page
- `/api/health` - JSON health status

### Verification Steps:

1. **Test Routes**: Visit each route to confirm 200 status
2. **Check Build Logs**: Verify "Next.js" framework detection
3. **API Endpoints**: Confirm JSON responses from API routes

### If This Strategy Fails:

Try the next strategy: **Optimized vercel.json Configuration**

Run: `npm run deploy:strategy2`

---

**📝 Note**: This manual configuration is the most reliable method for monorepo Next.js deployments on Vercel.
