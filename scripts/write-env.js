const fs = require('fs');
const envContent = `DATABASE_URL="postgresql://neondb_owner:npg_BIlfNjZg2Ko7@ep-restless-union-ai4sgr7d-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
SESSION_SECRET="pisairtel-erp-production-session-secret-2024"
SUPERADMIN_BOOTSTRAP_KEY="Dabonegareus2660"
NODE_ENV="production"
`;
fs.writeFileSync('c:\\temp\\pisairtel-deploy\\.env', envContent);
console.log('env written');
console.log(fs.readFileSync('c:\\temp\\pisairtel-deploy\\.env', 'utf8'));
