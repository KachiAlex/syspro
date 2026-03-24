#!/usr/bin/env pwsh
# Start the frontend dev server from the correct directory

$frontend_path = "D:\Syspro\syspro-erp-frontend"
Write-Host "Starting frontend dev server from: $frontend_path" -ForegroundColor Green

Set-Location $frontend_path
npm run dev
