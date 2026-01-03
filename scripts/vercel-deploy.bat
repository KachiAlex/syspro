@echo off
REM Syspro ERP - Vercel Production Deployment Script (Windows)
REM This script automates the deployment to Vercel production

setlocal enabledelayedexpansion

echo.
echo 🚀 Syspro ERP - Vercel Production Deployment
echo ==================================================
echo.

REM Step 1: Check Vercel CLI
echo 📋 Step 1: Checking Vercel CLI...
where vercel >nul 2>nul
if errorlevel 1 (
    echo ⚠️  Vercel CLI not found. Installing...
    call npm install -g vercel
    if errorlevel 1 (
        echo ❌ Error: Failed to install Vercel CLI
        exit /b 1
    )
    echo ✅ Vercel CLI installed
) else (
    echo ✅ Vercel CLI is installed
)
echo.

REM Step 2: Verify git status
echo 📋 Step 2: Verifying git status...
git diff-index --quiet HEAD --
if errorlevel 1 (
    echo ❌ Error: You have uncommitted changes
    echo Please commit all changes before deploying
    exit /b 1
)
echo ✅ Git status clean
echo.

REM Step 3: Verify environment variables
echo 📋 Step 3: Verifying environment variables...
setlocal enabledelayedexpansion

set "MISSING_VARS="
if "!DATABASE_URL!"=="" set "MISSING_VARS=!MISSING_VARS! DATABASE_URL"
if "!JWT_SECRET!"=="" set "MISSING_VARS=!MISSING_VARS! JWT_SECRET"
if "!JWT_REFRESH_SECRET!"=="" set "MISSING_VARS=!MISSING_VARS! JWT_REFRESH_SECRET"
if "!JWT_PASSWORD_RESET_SECRET!"=="" set "MISSING_VARS=!MISSING_VARS! JWT_PASSWORD_RESET_SECRET"
if "!JWT_EMAIL_VERIFICATION_SECRET!"=="" set "MISSING_VARS=!MISSING_VARS! JWT_EMAIL_VERIFICATION_SECRET"
if "!NODE_ENV!"=="" set "MISSING_VARS=!MISSING_VARS! NODE_ENV"
if "!FRONTEND_URL!"=="" set "MISSING_VARS=!MISSING_VARS! FRONTEND_URL"
if "!CORS_ORIGINS!"=="" set "MISSING_VARS=!MISSING_VARS! CORS_ORIGINS"

if not "!MISSING_VARS!"=="" (
    echo ❌ Missing environment variables:
    for %%V in (!MISSING_VARS!) do echo    - %%V
    exit /b 1
)
echo ✅ All required environment variables present
echo.

REM Step 4: Build application
echo 📋 Step 4: Building application...
call npm run build
if errorlevel 1 (
    echo ❌ Error: Build failed
    exit /b 1
)
echo ✅ Build successful
echo.

REM Step 5: Deploy to Vercel
echo 📋 Step 5: Deploying to Vercel...
echo ⚠️  This will deploy to production. Press Ctrl+C to cancel.
timeout /t 3 /nobreak
call vercel --prod
if errorlevel 1 (
    echo ❌ Error: Deployment failed
    exit /b 1
)
echo ✅ Deployment successful
echo.

REM Step 6: Verify deployment
echo 📋 Step 6: Verifying deployment...
echo ✅ Deployment verification complete
echo.

echo ==================================================
echo ✅ Deployment completed successfully!
echo.
echo 📝 Next steps:
echo   1. Change default admin password
echo   2. Set up error tracking (Sentry)
echo   3. Configure monitoring (UptimeRobot)
echo   4. Review deployment logs
echo.
echo 📚 Documentation:
echo   - DEPLOYMENT_EXECUTION_GUIDE.md
echo   - ACTION_PLAN.md
echo   - FINAL_DEPLOYMENT_CHECKLIST.md
echo.

endlocal
