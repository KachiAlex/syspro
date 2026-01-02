# 🚀 Vercel Deployment Instructions

## If You Can't Find Your Current Deployment

### Option 1: Find Existing Deployment
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Look for a project named "syspro", "syspro-erp", or similar
3. Click on it to get the deployment URL

### Option 2: Create New Deployment
If no deployment exists, create a new one:

1. **Go to Vercel Dashboard**
   - Visit [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "Add New..." → "Project"

2. **Import from GitHub**
   - Select "Import Git Repository"
   - Choose your `KachiAlex/syspro` repository
   - Click "Import"

3. **Configure Build Settings**
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

4. **Environment Variables** (Add these in Vercel dashboard)
   ```
   NODE_ENV=production
   NEXT_PUBLIC_API_BASE_URL=https://your-deployment-url.vercel.app
   ```

5. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Get your deployment URL

## Test Your Deployment

Once deployed, test these URLs:

```bash
# Replace YOUR_URL with your actual deployment URL

# Simple test page:
https://YOUR_URL/test

# API health checks:
https://YOUR_URL/api/health
https://YOUR_URL/api/v1/health

# Main application:
https://YOUR_URL/
https://YOUR_URL/login
```

## Expected Results

### /test page should show:
- ✅ "Deployment Successful!" message
- Links to test API endpoints
- "Go to Login" button

### /api/health should return:
```json
{
  "success": true,
  "message": "API is healthy",
  "timestamp": "2026-01-02T...",
  "version": "1.0.0",
  "environment": "production"
}
```

### /api/v1/health should return:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-01-02T...",
    "version": "1.0.0",
    "environment": "production",
    "uptime": 123.45,
    "memory": {
      "used": 25,
      "total": 50
    }
  },
  "message": "Service is healthy"
}
```

## If You Still Get 404 Errors

1. **Check Build Logs** in Vercel dashboard
2. **Verify Root Directory** is set to `apps/web`
3. **Check Environment Variables** are set correctly
4. **Redeploy** by pushing a new commit

## Need Help?

If you're still having issues, share:
1. Your actual Vercel deployment URL
2. Any error messages from the Vercel dashboard
3. Screenshots of the build logs