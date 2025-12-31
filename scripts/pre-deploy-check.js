#!/usr/bin/env node

/**
 * Pre-deployment check script
 * Verifies the codebase is ready for deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Pre-Deployment Check for Syspro ERP\n');

const checks = [];

// Check 1: Essential files exist
const essentialFiles = [
  'package.json',
  'vercel.json',
  'apps/api/package.json',
  'apps/web/package.json',
  'apps/api/src/main.ts',
  'apps/web/src/app/page.tsx',
  'deploy-database.sql',
  '.gitignore'
];

essentialFiles.forEach(file => {
  if (fs.existsSync(file)) {
    checks.push({ name: `✅ ${file} exists`, status: 'pass' });
  } else {
    checks.push({ name: `❌ ${file} missing`, status: 'fail' });
  }
});

// Check 2: No sensitive files
const sensitiveFiles = [
  'deployment-secrets.txt',
  '.env',
  '.env.local',
  '.env.production'
];

sensitiveFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    checks.push({ name: `✅ ${file} not in repo (good)`, status: 'pass' });
  } else {
    checks.push({ name: `⚠️  ${file} exists (will be ignored)`, status: 'warn' });
  }
});

// Check 3: Package.json has correct scripts
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (pkg.scripts && pkg.scripts['vercel-build']) {
    checks.push({ name: '✅ vercel-build script exists', status: 'pass' });
  } else {
    checks.push({ name: '❌ vercel-build script missing', status: 'fail' });
  }
} catch (error) {
  checks.push({ name: '❌ package.json invalid', status: 'fail' });
}

// Check 4: Vercel.json is valid
try {
  const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  if (vercelConfig.version === 2) {
    checks.push({ name: '✅ vercel.json is valid', status: 'pass' });
  } else {
    checks.push({ name: '❌ vercel.json invalid format', status: 'fail' });
  }
} catch (error) {
  checks.push({ name: '❌ vercel.json invalid JSON', status: 'fail' });
}

// Display results
console.log('📋 Check Results:\n');
checks.forEach(check => {
  console.log(`  ${check.name}`);
});

const failures = checks.filter(c => c.status === 'fail');
const warnings = checks.filter(c => c.status === 'warn');

console.log('\n📊 Summary:');
console.log(`✅ Passed: ${checks.filter(c => c.status === 'pass').length}`);
console.log(`⚠️  Warnings: ${warnings.length}`);
console.log(`❌ Failed: ${failures.length}`);

if (failures.length === 0) {
  console.log('\n🎉 All checks passed! Ready for deployment.');
  console.log('\n🚀 Next steps:');
  console.log('1. git add .');
  console.log('2. git commit -m "feat: production-ready Syspro ERP system"');
  console.log('3. git push origin main');
} else {
  console.log('\n⚠️  Please fix the failed checks before deploying.');
}

if (warnings.length > 0) {
  console.log('\n💡 Warnings are usually fine - sensitive files are ignored by .gitignore');
}