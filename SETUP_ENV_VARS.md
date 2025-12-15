# Setup Environment Variables in Vercel

## Required Environment Variables

You need to add these environment variables to your Vercel project for the backend to work and create the database schema.

## Step-by-Step Instructions

### 1. Go to Vercel Dashboard
- Visit: https://vercel.com/dashboard
- Click on your **syspro-erp** project

### 2. Navigate to Environment Variables
- Click **Settings** (top menu)
- Click **Environment Variables** (left sidebar)

### 3. Add Database Connection String

**Variable Name:** `POSTGRES_URL`

**Value:** Your Neon connection string from the Neon dashboard

Example format:
```
postgresql://user:password@hostname.neon.tech/database?sslmode=require
```

To get your Neon connection string:
1. Go to [Neon Console](https://console.neon.tech)
2. Select your project
3. Click **Dashboard**
4. Look for **Connection Details** or **Connection String**
5. Copy the full connection string

**Environment:** Select **Production** (check the box)

Click **Save**

### 4. Add Enable Sync Variable

**Variable Name:** `ENABLE_SYNC`

**Value:** `true`

**Environment:** Select **Production** (check the box)

Click **Save**

### 5. Add CORS Origin (Optional but Recommended)

**Variable Name:** `CORS_ORIGIN`

**Value:** `*` (or your specific frontend domain)

**Environment:** Select **Production**

Click **Save**

### 6. Add JWT Secret (Required for Auth)

**Variable Name:** `JWT_SECRET`

**Value:** Generate a random secret (e.g., use a password generator)

Example: `your-super-secret-jwt-key-change-this-in-production`

**Environment:** Select **Production**

Click **Save**

### 7. Redeploy

After adding all environment variables:

1. Go back to your project dashboard
2. Click **Deployments** tab
3. Click the **...** menu on the latest deployment
4. Click **Redeploy**

OR run in your terminal:
```bash
vercel --prod
```

## Verification

After redeploying with the environment variables:

1. Test the API: `https://your-deployment-url.vercel.app/api`
2. Go to Neon SQL Editor and run:
   ```sql
   SELECT COUNT(*) as total_tables
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_type = 'BASE TABLE';
   ```
3. You should see 15-20+ tables

## Important: Disable ENABLE_SYNC After Schema Creation

Once you confirm tables are created:
1. Go back to Environment Variables
2. Change `ENABLE_SYNC` from `true` to `false` (or delete it)
3. Redeploy

This prevents automatic schema changes in production.

