const { execSync } = require('child_process');

const SSH_KEY = 'c:\\temp\\pisairtel-key';
const SSH_HOST = 'pisairtel@192.250.227.18';
const SSH_OPTS = '-o StrictHostKeyChecking=no -o ConnectTimeout=30 -o ServerAliveInterval=10 -o ServerAliveCountMax=3';
const APP_DIR = '/home/pisairtel/pisairtelschools.com';
const DOMAIN_DIR = '/home/pisairtel/public_html/Pisairtelschools.com';

function sshExec(cmd, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const fullCmd = `ssh -i "${SSH_KEY}" ${SSH_OPTS} ${SSH_HOST} "${cmd.replace(/"/g, '\\"').replace(/`/g, '\\`')}"`;
      const output = execSync(fullCmd, { encoding: 'utf8', timeout: 600000, maxBuffer: 20 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
      return output;
    } catch (err) {
      const errOut = (err.stderr || '').trim();
      const stdOut = (err.stdout || '').trim();
      if (i < retries - 1) {
        console.log(`  retry ${i + 1}/${retries}... (${errOut || err.message})`);
        // Wait before retry
        execSync('timeout /t 3 /nobreak > nul');
      } else {
        // Return whatever output we got, even if error
        return stdOut + '\n[ERROR] ' + (errOut || err.message);
      }
    }
  }
  return '[FAILED after retries]';
}

function sshHeredoc(heredocScript, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const fullCmd = `ssh -i "${SSH_KEY}" ${SSH_OPTS} ${SSH_HOST} "bash -s"`;
      const output = execSync(fullCmd, {
        encoding: 'utf8',
        timeout: 600000,
        maxBuffer: 20 * 1024 * 1024,
        input: heredocScript,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return output;
    } catch (err) {
      const errOut = (err.stderr || '').trim();
      const stdOut = (err.stdout || '').trim();
      if (i < retries - 1) {
        console.log(`  retry ${i + 1}/${retries}... (${errOut || err.message})`);
        execSync('timeout /t 3 /nobreak > nul');
      } else {
        return stdOut + '\n[ERROR] ' + (errOut || err.message);
      }
    }
  }
  return '[FAILED after retries]';
}

console.log('=== DEPLOYING TO pisairtelschools.com ===\n');

// Step 1: Create app dir
console.log('\n--- Step 1: Create app dir ---');
console.log(sshExec(`mkdir -p ${APP_DIR} && echo "dir ready"`).trim());

// Step 2: Clone fresh repo
console.log('\n--- Step 2: Clone repo ---');
console.log(sshExec(`cd ~ && rm -rf syspro-deploy && git clone --depth 1 https://github.com/KachiAlex/syspro.git syspro-deploy 2>&1 | tail -5`).trim());

// Step 3: Copy files
console.log('\n--- Step 3: Copy files ---');
console.log(sshExec(`cp -r ~/syspro-deploy/* ${APP_DIR}/ && cp ~/syspro-deploy/.gitignore ${APP_DIR}/ 2>/dev/null; cp ~/syspro-deploy/tsconfig.json ${APP_DIR}/ 2>/dev/null; cp ~/syspro-deploy/next.config.js ${APP_DIR}/ 2>/dev/null; echo "copied"`).trim());

// Step 4: Install dependencies
console.log('\n--- Step 4: npm install ---');
console.log(sshExec(`cd ${APP_DIR} && PATH=/opt/alt/alt-nodejs24/root/bin:$PATH npm install --production=false 2>&1 | tail -10`).trim());

// Step 5: Create .env
console.log('\n--- Step 5: Create .env ---');
console.log(sshHeredoc(`cat > ${APP_DIR}/.env << 'ENVEOF'
DATABASE_URL="postgresql://neondb_owner:npg_BIlfNjZg2Ko7@ep-restless-union-ai4sgr7d-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
SESSION_SECRET="pisairtel-erp-production-session-secret-2024"
SUPERADMIN_BOOTSTRAP_KEY="Dabonegareus2660"
NODE_ENV="production"
ENVEOF
echo "env created"
`).trim());

// Step 6: Build Next.js
console.log('\n--- Step 6: Build Next.js ---');
console.log(sshExec(`cd ${APP_DIR} && PATH=/opt/alt/alt-nodejs24/root/bin:$PATH NODE_OPTIONS="--max-old-space-size=2048" TAILWIND_DISABLE_LIGHTNINGCSS=1 npx next build 2>&1 | tail -30`).trim());

// Step 7: Create server.js
console.log('\n--- Step 7: Create server.js ---');
console.log(sshHeredoc(`cat > ${APP_DIR}/server.js << 'SJEOF'
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
`).trim());

// Step 8: Configure .htaccess for domain -> point Passenger to app
console.log('\n--- Step 8: Configure .htaccess ---');
console.log(sshHeredoc(`cat > ${DOMAIN_DIR}/.htaccess << 'HTEOF'
PassengerAppRoot ${APP_DIR}
PassengerNodePath /opt/alt/alt-nodejs24/root/bin/node
PassengerAppType node
PassengerStartupFile server.js
PassengerFriendlyErrorPages off
HTEOF
echo "htaccess created"
`).trim());

// Step 9: Restart app
console.log('\n--- Step 9: Restart app ---');
console.log(sshExec(`mkdir -p ${APP_DIR}/tmp && touch ${APP_DIR}/tmp/restart.txt && echo "restart triggered"`).trim());

// Step 10: Verify
console.log('\n--- Step 10: Verify ---');
console.log(sshExec(`ls -la ${APP_DIR}/.next/BUILD_ID ${APP_DIR}/server.js ${APP_DIR}/.env 2>&1 && echo "---BUILD_ID---" && cat ${APP_DIR}/.next/BUILD_ID`).trim());

// Step 11: Cleanup
console.log('\n--- Step 11: Cleanup ---');
console.log(sshExec(`rm -rf ~/syspro-deploy && echo "cleaned up"`).trim());

console.log('\n=== DEPLOYMENT COMPLETE ===');
console.log('The app should now be available at https://pisairtelschools.com');
