# PowerShell script to seed the Syspro platform
# This creates the admin user and subscription plans

Write-Host "🌱 Seeding Syspro Platform..." -ForegroundColor Green
Write-Host ""

$url = "https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/api/platform/seed"

Write-Host "📡 Calling seed endpoint..." -ForegroundColor Cyan
Write-Host "   URL: $url" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -UseBasicParsing
    
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host "📋 PLATFORM INITIALIZED" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host ""
    
    if ($response.success) {
        Write-Host "🔐 SUPER ADMIN CREDENTIALS:" -ForegroundColor Cyan
        Write-Host "   Email:    $($response.credentials.email)" -ForegroundColor White
        Write-Host "   Password: $($response.credentials.password)" -ForegroundColor White
        Write-Host ""
        Write-Host "⚠️  WARNING: CHANGE THIS PASSWORD IMMEDIATELY!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Created:" -ForegroundColor Cyan
        Write-Host "   - 4 Subscription Plans (Free, Starter, Professional, Enterprise)" -ForegroundColor Gray
        Write-Host "   - Platform Organization and Tenant" -ForegroundColor Gray
        Write-Host "   - Super Admin User" -ForegroundColor Gray
        Write-Host "   - Demo Organization and Tenant" -ForegroundColor Gray
        Write-Host ""
        Write-Host "🎯 NEXT STEPS:" -ForegroundColor Cyan
        Write-Host "   1. Login at: https://syspro-8anuk5s0u-onyedikachi-akomas-projects.vercel.app/login" -ForegroundColor Gray
        Write-Host "   2. Change admin password" -ForegroundColor Gray
        Write-Host "   3. Explore tenant management at: /api/tenants" -ForegroundColor Gray
        Write-Host "   4. View API docs at: /api/docs" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host "ℹ️  $($response.message)" -ForegroundColor Yellow
        if ($response.error) {
            Write-Host "   Error: $($response.error)" -ForegroundColor Red
        }
    }
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    
    if ($statusCode -eq 401 -or $statusCode -eq 403) {
        Write-Host "🔒 AUTHENTICATION REQUIRED" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Vercel deployment protection is enabled." -ForegroundColor Gray
        Write-Host ""
        Write-Host "📝 OPTIONS:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Option 1: Use Postman/Thunder Client" -ForegroundColor White
        Write-Host "   - Open Postman" -ForegroundColor Gray
        Write-Host "   - Method: POST" -ForegroundColor Gray
        Write-Host "   - URL: $url" -ForegroundColor Gray
        Write-Host "   - Click 'Send'" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Option 2: Get Vercel Bypass Token" -ForegroundColor White
        Write-Host "   1. Go to: https://vercel.com/onyedikachi-akomas-projects/syspro/settings/deployment-protection" -ForegroundColor Gray
        Write-Host "   2. Copy 'Protection Bypass for Automation' token" -ForegroundColor Gray
        $bypassUrl = "${url}?x-vercel-set-bypass-cookie=true`&x-vercel-protection-bypass=YOUR_TOKEN"
        Write-Host "   3. Visit: $bypassUrl" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Option 3: Temporarily Disable Protection" -ForegroundColor White
        Write-Host "   1. Go to Vercel project settings → Deployment Protection" -ForegroundColor Gray
        Write-Host "   2. Set to 'No Protection'" -ForegroundColor Gray
        Write-Host "   3. Run this script again" -ForegroundColor Gray
        Write-Host "   4. Re-enable protection" -ForegroundColor Gray
        Write-Host ""
        Write-Host "📚 See SEED_INSTRUCTIONS.md for detailed steps" -ForegroundColor Cyan
        
    } else {
        Write-Host "❌ SEED FAILED" -ForegroundColor Red
        Write-Host ""
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "💡 Troubleshooting:" -ForegroundColor Yellow
        Write-Host "   - Check if the database is accessible" -ForegroundColor Gray
        Write-Host "   - Verify POSTGRES_URL is set in Vercel environment" -ForegroundColor Gray
        Write-Host "   - Check Vercel function logs for details" -ForegroundColor Gray
        Write-Host "   - The seed may have already been run (it is idempotent)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""

