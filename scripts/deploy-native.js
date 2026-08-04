const { execSync } = require('child_process');
const fs = require('fs');

const SSH_KEY = 'c:\\temp\\pisairtel-key';
const SSH_HOST = 'pisairtel@192.250.227.18';
const SSH_BASE = `ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no -o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=120`;
const APP_DIR = '/home/pisairtel/pisairtelschools.com';
const DOMAIN_DIR = '/home/pisairtel/public_html/Pisairtelschools.com';

function runSSH(label, command) {
  console.log(`\n--- ${label} ---`);
  console.log('Running...');
  try {
    const fullCmd = `${SSH_BASE} ${SSH_HOST} "${command.replace(/"/g, '\\"')}"`;
    const output = execSync(fullCmd, { encoding: 'utf8', timeout: 600000, maxBuffer: 10 * 1024 * 1024 });
    console.log(output.trim() || '(no output)');
    return true;
  } catch (err) {
    const msg = err.stderr || err.stdout || err.message;
    console.log(`FAILED: ${msg.trim() || err.message}`);
    return false;
  }
}

function runSSHHeredoc(label, heredocContent) {
  console.log(`\n--- ${label} ---`);
  console.log('Running...');
  try {
    // Use stdin pipe for heredoc content
    const fullCmd = `${SSH_BASE} ${SSH_HOST} 'bash -s'`;
    const output = execSync(fullCmd, {
      encoding: 'utf8',
      timeout: 600000,
      maxBuffer: 10 * 1024 * 1024,
      input: heredocContent,
    });
    console.log(output.trim() || '(no output)');
    return true;
  } catch (err) {
    const msg = err.stderr || err.stdout || err.message;
    console.log(`FAILED: ${msg.trim() || err.message}`);
    return false;
  }
}

console.log('=== DEPLOYING TO pisairtelschools.com ===\n');

// Step 1: Create app dir
runSSH('Step 1: Create app dir', `mkdir -p ${APP_DIR} && echo "dir ready"`);

// Step 2: Clone fresh repo
runSSH('Step 2: Clone repo', `cd ~ && rm -rf syspro-deploy && git clone --depth 1 https://github.com/KachiAlex/syspro.git syspro-deploy 2>&1 | tail -5`);

// Step 3: Copy files to app dir
runSSH('Step 3: Copy files', `cp -r ~/syspro-deploy/* ${APP_DIR}/ && cp ~/syspro-deploy/.gitignore ${APP_DIR}/ 2>/dev/null; cp ~/syspro-deploy/tsconfig.json ${APP_DIR}/ 2>/dev/null; cp ~/syspro-deploy/next.config.js ${APP_DIR}/ 2>/dev/null; echo "copied"`);

// Step 4: Install dependencies
runSSH('Step 4: npm install', `cd ${APP_DIR} && PATH=/opt/alt/alt-nodejs24/root/bin:$PATH npm install --production=false 2>&1 | tail -10`);

// Step 5: Create .env
runSSHHeredoc('Step 5: Create .env', `cat > ${APP_DIR}/.env << 'ENVEOF'
DATABASE_URL="postgresql://neondb_owner:npg_BIlfNjZg2Ko7@ep-restless-union-ai4sgr7d-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
SESSION_SECRET="pisairtel-erp-production-session-secret-2024"
SUPERADMIN_BOOTSTRAP_KEY="Dabonegareus2660"
NODE_ENV="production"
ENVEOF
echo "env created"
`);

// Step 6: Build Next.js
runSSH('Step 6: Build Next.js', `cd ${APP_DIR} && PATH=/opt/alt/alt-nodejs24/root/bin:$PATH NODE_OPTIONS="--max-old-space-size=2048" TAILWIND_DISABLE_LIGHTNINGCSS=1 npx next build 2>&1 | tail -30`);

// Step 7: Create server.js
runSSHHeredoc('Step 7: Create server.js', `cat > ${APP_DIR}/server.js << 'SJEOF'
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
`);

// Step 8: Configure .htaccess for domain
runSSHHeredoc('Step 8: Configure .htaccess', `cat > ${DOMAIN_DIR}/.htaccess << 'HTEOF'
PassengerAppRoot ${APP_DIR}
PassengerNodePath /opt/alt/alt-nodejs24/root/bin/node
PassengerAppType node
PassengerStartupFile server.js
PassengerFriendlyErrorPages off
HTEOF
echo "htaccess created"
`);

// Step 9: Restart app
runSSH('Step 9: Restart app', `mkdir -p ${APP_DIR}/tmp && touch ${APP_DIR}/tmp/restart.txt && echo "restart triggered"`);

// Step 10: Verify
runSSH('Step 10: Verify', `ls -la ${APP_DIR}/.next/BUILD_ID ${APP_DIR}/server.js ${APP_DIR}/.env 2>&1 && echo "---BUILD_ID---" && cat ${APP_DIR}/.next/BUILD_ID`);

// Step 11: Cleanup
runSSH('Step 11: Cleanup', `rm -rf ~/syspro-deploy && echo "cleaned up"`);

console.log('\n=== DEPLOYMENT COMPLETE ===');
console.log('\nThe app should now be available at https://pisairtelschools.com');
