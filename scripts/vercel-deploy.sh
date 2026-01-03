#!/bin/bash

# Syspro ERP - Vercel Production Deployment Script
# This script automates the deployment to Vercel production

set -e

echo ""
echo "🚀 Syspro ERP - Vercel Production Deployment"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check Vercel CLI
echo "📋 Step 1: Checking Vercel CLI..."
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
    echo -e "${GREEN}✅ Vercel CLI installed${NC}"
else
    echo -e "${GREEN}✅ Vercel CLI is installed${NC}"
fi
echo ""

# Step 2: Verify git status
echo "📋 Step 2: Verifying git status..."
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}❌ Error: You have uncommitted changes${NC}"
    echo "Please commit all changes before deploying"
    exit 1
fi
echo -e "${GREEN}✅ Git status clean${NC}"
echo ""

# Step 3: Verify environment variables
echo "📋 Step 3: Verifying environment variables..."
REQUIRED_VARS=(
    "DATABASE_URL"
    "JWT_SECRET"
    "JWT_REFRESH_SECRET"
    "JWT_PASSWORD_RESET_SECRET"
    "JWT_EMAIL_VERIFICATION_SECRET"
    "NODE_ENV"
    "FRONTEND_URL"
    "CORS_ORIGINS"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    exit 1
fi
echo -e "${GREEN}✅ All required environment variables present${NC}"
echo ""

# Step 4: Build application
echo "📋 Step 4: Building application..."
npm run build
echo -e "${GREEN}✅ Build successful${NC}"
echo ""

# Step 5: Deploy to Vercel
echo "📋 Step 5: Deploying to Vercel..."
echo -e "${YELLOW}⚠️  This will deploy to production. Press Ctrl+C to cancel.${NC}"
sleep 3
vercel --prod
echo -e "${GREEN}✅ Deployment successful${NC}"
echo ""

# Step 6: Verify deployment
echo "📋 Step 6: Verifying deployment..."
DEPLOYMENT_URL=$(vercel ls --json | jq -r '.[0].url')
if [ ! -z "$DEPLOYMENT_URL" ]; then
    echo -e "${GREEN}✅ Latest deployment: https://$DEPLOYMENT_URL${NC}"
    
    echo "🧪 Testing health endpoint..."
    if curl -s "https://$DEPLOYMENT_URL/api/v1/health" | grep -q "ok"; then
        echo -e "${GREEN}✅ Health check passed${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not verify health endpoint${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Could not retrieve deployment URL${NC}"
fi
echo ""

echo "=================================================="
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "📝 Next steps:"
echo "  1. Change default admin password"
echo "  2. Set up error tracking (Sentry)"
echo "  3. Configure monitoring (UptimeRobot)"
echo "  4. Review deployment logs"
echo ""
echo "📚 Documentation:"
echo "  - DEPLOYMENT_EXECUTION_GUIDE.md"
echo "  - ACTION_PLAN.md"
echo "  - FINAL_DEPLOYMENT_CHECKLIST.md"
echo ""
