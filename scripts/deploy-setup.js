#!/usr/bin/env node

/**
 * Syspro ERP Deployment Setup Script
 * Helps generate secure environment variables and provides deployment checklist
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🚀 Syspro ERP Deployment Setup\n');

// Generate secure JWT secrets
function generateSecret() {
  return crypto.randomBytes(32).toString('base64');
}

const secrets = {
  JWT_SECRET: generateSecret(),
  JWT_REFRESH_SECRET: generateSecret(),
  JWT_PASSWORD_RESET_SECRET: generateSecret(),
  JWT_EMAIL_VERIFICATION_SECRET: generateSecret(),
};

console.log('🔐 Generated JWT Secrets:');
console.log('Copy these to your Vercel environment variables:\n');

Object.entries(secrets).forEach(([key, value]) => {
  console.log(`${key}=${value}`);
});

console.log('\n📋 Deployment Checklist:');
console.log('□ 1. Run database script in Neon SQL Editor');
console.log('□ 2. Copy JWT secrets above to Vercel environment variables');
console.log('□ 3. Set DATABASE_URL in Vercel (from Neon console)');
console.log('□ 4. Set FRONTEND_URL to your Vercel app URL');
console.log('□ 5. Push code to GitHub (triggers Vercel deployment)');
console.log('□ 6. Test API health: /api/v1/health');
console.log('□ 7. Get tenant ID from database');
console.log('□ 8. Test login with admin@syspro.com / Admin@123');

console.log('\n🔍 Quick Commands:');
console.log('# Get tenant ID from database:');
console.log("SELECT id, name, code FROM tenants WHERE code = 'PLATFORM';");

console.log('\n# Test API health:');
console.log('curl https://your-app.vercel.app/api/v1/health');

console.log('\n# Test login (replace YOUR_TENANT_ID):');
console.log(`curl -X POST https://your-app.vercel.app/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -H "X-Tenant-ID: YOUR_TENANT_ID" \\
  -d '{
    "email": "admin@syspro.com",
    "password": "Admin@123"
  }'`);

console.log('\n✅ Setup complete! Follow the checklist above to deploy.');

// Save secrets to a file for reference
const secretsFile = path.join(__dirname, '..', 'deployment-secrets.txt');
const secretsContent = `# Syspro ERP Deployment Secrets
# Generated on: ${new Date().toISOString()}
# 
# IMPORTANT: Add these to your Vercel environment variables
# DO NOT commit this file to version control

${Object.entries(secrets).map(([key, value]) => `${key}=${value}`).join('\n')}

# Additional required variables:
# DATABASE_URL=your_neon_connection_string
# FRONTEND_URL=https://your-vercel-app.vercel.app
# CORS_ORIGINS=https://your-vercel-app.vercel.app,https://*.vercel.app
# NODE_ENV=production
`;

fs.writeFileSync(secretsFile, secretsContent);
console.log(`\n💾 Secrets saved to: ${secretsFile}`);
console.log('⚠️  Remember to delete this file after setting up Vercel!');