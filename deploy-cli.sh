#!/bin/bash

# Vercel CLI Deployment Script
# Strategy 3: Direct CLI deployment with explicit Next.js configuration

echo "🚀 Starting Vercel CLI deployment..."

# Navigate to web app directory
cd apps/web

# Ensure Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Login to Vercel (if not already logged in)
echo "🔐 Checking Vercel authentication..."
vercel whoami || vercel login

# Deploy with explicit Next.js framework
echo "📦 Deploying with explicit Next.js configuration..."
vercel --prod --confirm --framework nextjs

echo "✅ CLI deployment completed!"
echo "🧪 Test your routes after deployment completes."
