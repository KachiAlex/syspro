# 🚀 GitHub Actions Deployment Setup

**Status**: Ready to configure
**Date**: January 3, 2026

---

## Overview

GitHub Actions will automatically deploy to Vercel whenever you push to the `main` branch. This bypasses the Vercel CLI rate limit and provides continuous deployment.

---

## Step 1: Get Vercel Tokens

### 1.1 Get VERCEL_TOKEN

1. Go to [Vercel Account Settings](https://vercel.com/account/tokens)
2. Click "Create Token"
3. Name it: `github-actions-deploy`
4. Select scope: `Full Account`
5. Copy the token (you'll need it in Step 2)

### 1.2 Get VERCEL_ORG_ID

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your team/organization name
3. Go to Settings → General
4. Find "Team ID" - this is your VERCEL_ORG_ID
5. Copy it

### 1.3 Get VERCEL_PROJECT_ID

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on the `syspro-web` project
3. Go to Settings → General
4. Find "Project ID" - this is your VERCEL_PROJECT_ID
5. Copy it

---

## Step 2: Add GitHub Secrets

1. Go to your GitHub repository: `https://github.com/KachiAlex/syspro`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

### Add these 3 secrets:

**Secret 1: VERCEL_TOKEN**
- Name: `VERCEL_TOKEN`
- Value: (paste the token from Step 1.1)
- Click "Add secret"

**Secret 2: VERCEL_ORG_ID**
- Name: `VERCEL_ORG_ID`
- Value: (paste the ID from Step 1.2)
- Click "Add secret"

**Secret 3: VERCEL_PROJECT_ID**
- Name: `VERCEL_PROJECT_ID`
- Value: (paste the ID from Step 1.3)
- Click "Add secret"

---

## Step 3: Verify Workflow File

The workflow file is already created at `.github/workflows/deploy-to-vercel.yml`

It will:
1. Trigger on every push to `main` branch
2. Install Vercel CLI
3. Deploy to production
4. Verify deployment succeeded

---

## Step 4: Trigger First Deployment

### Option A: Automatic (Recommended)
```bash
git push origin main
```

This will automatically trigger the GitHub Actions workflow.

### Option B: Manual Trigger
1. Go to GitHub repository
2. Click **Actions** tab
3. Click **Deploy to Vercel** workflow
4. Click **Run workflow** → **Run workflow**

---

## Step 5: Monitor Deployment

1. Go to GitHub repository
2. Click **Actions** tab
3. Click the latest workflow run
4. Watch the deployment progress
5. Once complete, check the deployment URL

---

## Expected Output

```
✅ Checkout code
✅ Install Vercel CLI
✅ Deploy to Vercel
✅ Verify Deployment

Deployment completed successfully
Check https://syspro-erp.vercel.app for the live application
```

---

## Troubleshooting

### Workflow doesn't run
- **Check**: GitHub Actions is enabled in repository settings
- **Fix**: Go to Settings → Actions → General → Enable Actions

### Deployment fails with "Invalid token"
- **Check**: VERCEL_TOKEN is correct
- **Fix**: Regenerate token and update GitHub secret

### Deployment fails with "Project not found"
- **Check**: VERCEL_PROJECT_ID is correct
- **Fix**: Verify project ID from Vercel dashboard

### Deployment fails with "Unauthorized"
- **Check**: VERCEL_ORG_ID is correct
- **Fix**: Verify org ID from Vercel dashboard

---

## Environment Variables in Vercel

After the first deployment succeeds, set these environment variables in Vercel dashboard:

**Go to**: `https://vercel.com/onyedikachi-akomas-projects/syspro-web/settings/environment-variables`

```env
DATABASE_URL=postgresql://user:password@host/syspro-prod?sslmode=require
JWT_SECRET=<generate-strong-256-bit-secret>
JWT_REFRESH_SECRET=<generate-strong-256-bit-secret>
JWT_PASSWORD_RESET_SECRET=<generate-strong-256-bit-secret>
JWT_EMAIL_VERIFICATION_SECRET=<generate-strong-256-bit-secret>
NODE_ENV=production
FRONTEND_URL=https://syspro-erp.vercel.app
CORS_ORIGINS=https://syspro-erp.vercel.app
THROTTLE_TTL=60
THROTTLE_LIMIT=50
ENABLE_SWAGGER=false
ENABLE_METRICS=true
```

---

## Continuous Deployment

Once set up, every push to `main` will automatically:
1. Build the application
2. Run tests
3. Deploy to Vercel
4. Update the live application

No manual deployment needed!

---

## Quick Reference

| Step | Action | Time |
|------|--------|------|
| 1 | Get Vercel tokens | 5 min |
| 2 | Add GitHub secrets | 5 min |
| 3 | Verify workflow file | 1 min |
| 4 | Trigger deployment | 1 min |
| 5 | Monitor deployment | 5-10 min |
| **Total** | **Setup complete** | **~20 min** |

---

## Next Steps

1. **Complete Step 1-3 above** to set up GitHub Actions
2. **Push to main** to trigger automatic deployment
3. **Monitor the deployment** in GitHub Actions tab
4. **Set environment variables** in Vercel dashboard
5. **Run database migrations** after deployment succeeds

---

## Support

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vercel GitHub Integration](https://vercel.com/docs/git/github)
- [Vercel CLI Documentation](https://vercel.com/docs/cli)

---

**Status**: Ready to configure

**Next Action**: Follow Steps 1-4 above to set up GitHub Actions deployment

