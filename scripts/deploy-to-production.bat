@echo off
REM Syspro ERP - Production Deployment Script (Windows)
REM This script prepares the application for production deployment to Vercel

setlocal enabledelayedexpansion

echo.
echo 🚀 Syspro ERP - Production Deployment Script
echo =============================================
echo.

REM Check if we're on main branch
for /f %%i in ('git rev-parse --abbrev-ref HEAD') do set CURRENT_BRANCH=%%i

if not "%CURRENT_BRANCH%"=="main" (
    echo ❌ Error: You must be on the main branch to deploy
    exit /b 1
)

echo ✓ On main branch
echo.

REM Check if working tree is clean
git diff-index --quiet HEAD --
if errorlevel 1 (
    echo ❌ Error: Working tree is not clean. Please commit all changes.
    exit /b 1
)

echo ✓ Working tree is clean
echo.

REM Verify dependencies
echo 📦 Verifying dependencies...
call npm install --silent
if errorlevel 1 (
    echo ❌ Error: Failed to install dependencies
    exit /b 1
)
echo ✓ Dependencies installed
echo.

REM Build the application
echo 🔨 Building application...
call npm run build
if errorlevel 1 (
    echo ❌ Error: Build failed
    exit /b 1
)
echo ✓ Build successful
echo.

REM Get current commit info
for /f %%i in ('git rev-parse --short HEAD') do set COMMIT_HASH=%%i
for /f %%i in ('git log -1 --pretty=%%B') do set COMMIT_MESSAGE=%%i

echo 📋 Deployment Information:
echo   Branch: %CURRENT_BRANCH%
echo   Commit: %COMMIT_HASH%
echo   Message: %COMMIT_MESSAGE%
echo.

echo ✅ Application is ready for production deployment!
echo.
echo 📝 Next Steps:
echo   1. Go to https://vercel.com/dashboard
echo   2. Import the GitHub repository (if not already imported)
echo   3. Set environment variables in Vercel dashboard:
echo      - DATABASE_URL (Neon PostgreSQL)
echo      - REDIS_URL (Upstash Redis)
echo      - JWT_SECRET, JWT_REFRESH_SECRET, etc.
echo      - FRONTEND_URL, CORS_ORIGINS
echo   4. Click 'Deploy'
echo   5. Verify deployment with health check:
echo      curl https://your-app.vercel.app/api/v1/health
echo.
echo 🔒 Security Reminders:
echo   - Change default admin password immediately
echo   - Use strong JWT secrets (256-bit minimum)
echo   - Enable database SSL
echo   - Configure proper CORS origins
echo   - Set up monitoring and alerting
echo.
echo 📚 Documentation:
echo   - Deployment Guide: DEPLOYMENT.md
echo   - Production Status: PRODUCTION_DEPLOYMENT_READY.md
echo   - Requirements: .kiro/specs/module-registry-system/requirements.md
echo   - Design: .kiro/specs/module-registry-system/design.md
echo.

endlocal
