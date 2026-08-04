const { execSync } = require('child_process');

const SSH_KEY = 'c:\\temp\\pisairtel-key';
const SSH_HOST = 'pisairtel@192.250.227.18';
const SSH_OPTS = '-o StrictHostKeyChecking=no -o ConnectTimeout=30 -o ServerAliveInterval=10 -o ServerAliveCountMax=3';
const APP_DIR = '/home/pisairtel/pisairtelschools.com';
const DOMAIN_DIR = '/home/pisairtel/public_html/Pisairtelschools.com';

function sleep(ms) {
  execSync(`powershell -Command "Start-Sleep -Milliseconds ${ms}"`);
}

function sshBash(script, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      const fullCmd = `ssh -i "${SSH_KEY}" ${SSH_OPTS} ${SSH_HOST} "bash -s"`;
      const output = execSync(fullCmd, {
        encoding: 'utf8',
        timeout: 600000,
        maxBuffer: 50 * 1024 * 1024,
        input: script,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return output;
    } catch (err) {
      const errOut = (err.stderr || '').trim();
      const stdOut = (err.stdout || '').trim();
      if (i < retries - 1) {
        process.stdout.write(`  retry ${i + 1}/${retries}... (${errOut || err.message})\n`);
        sleep(3000);
      } else {
        return stdOut + '\n[ERROR] ' + (errOut || err.message);
      }
    }
  }
  return '[FAILED after retries]';
}

// Build the entire deployment as a single bash script
const deployScript = `set -e

echo "=== STEP 1: Create app dir ==="
mkdir -p ${APP_DIR}
echo "dir ready"

echo "=== STEP 2: Clone repo ==="
cd ~
rm -rf syspro-deploy
git clone --depth 1 https://github.com/KachiAlex/syspro.git syspro-deploy 2>&1 | tail -5
echo "clone done"

echo "=== STEP 3: Copy files ==="
cp -r ~/syspro-deploy/* ${APP_DIR}/
cp ~/syspro-deploy/.gitignore ${APP_DIR}/ 2>/dev/null || true
cp ~/syspro-deploy/tsconfig.json ${APP_DIR}/ 2>/dev/null || true
cp ~/syspro-deploy/next.config.js ${APP_DIR}/ 2>/dev/null || true
echo "copied"

echo "=== STEP 4: npm install ==="
cd ${APP_DIR}
PATH=/opt/alt/alt-nodejs24/root/bin:$PATH npm install --production=false 2>&1 | tail -10
echo "npm install done"

echo "=== STEP 5: Create .env ==="
cat > ${APP_DIR}/.env << 'ENVEOF'
DATABASE_URL="postgresql://neondb_owner:npg_BIlfNjZg2Ko7@ep-restless-union-ai4sgr7d-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
SESSION_SECRET="pisairtel-erp-production-session-secret-2024"
SUPERADMIN_BOOTSTRAP_KEY="Dabonegareus2660"
NODE_ENV="production"
ENVEOF
echo "env created"

echo "=== STEP 6: Build Next.js ==="
cd ${APP_DIR}
PATH=/opt/alt/alt-nodejs24/root/bin:$PATH NODE_OPTIONS="--max-old-space-size=2048" TAILWIND_DISABLE_LIGHTNINGCSS=1 npx next build 2>&1 | tail -30
echo "build done"

echo "=== STEP 7: Create server.js ==="
cat > ${APP_DIR}/server.js << 'SJEOF'
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, hostname, (err) => {
    if (err) throw err;
    console.log('> Ready on http://' + hostname + ':' + port);
  });
});
SJEOF
echo "server.js created"

echo "=== STEP 8: Configure .htaccess ==="
cat > ${DOMAIN_DIR}/.htaccess << 'HTEOF'
PassengerAppRoot ${APP_DIR}
PassengerNodePath /opt/alt/alt-nodejs24/root/bin/node
PassengerAppType node
PassengerStartupFile server.js
PassengerFriendlyErrorPages off
HTEOF
echo "htaccess created"

echo "=== STEP 9: Restart app ==="
mkdir -p ${APP_DIR}/tmp
touch ${APP_DIR}/tmp/restart.txt
echo "restart triggered"

echo "=== STEP 10: Verify ==="
ls -la ${APP_DIR}/.next/BUILD_ID ${APP_DIR}/server.js ${APP_DIR}/.env 2>&1
echo "---BUILD_ID---"
cat ${APP_DIR}/.next/BUILD_ID 2>/dev/null || echo "NO BUILD ID"

echo "=== STEP 11: Cleanup ==="
rm -rf ~/syspro-deploy
echo "cleaned up"

echo "=== ALL DONE ==="
`;

console.log('=== DEPLOYING TO pisairtelschools.com ===');
console.log('Running all steps in a single SSH session...\n');

const output = sshBash(deployScript);
console.log(output);

console.log('\n=== DEPLOYMENT ATTEMPT COMPLETE ===');
