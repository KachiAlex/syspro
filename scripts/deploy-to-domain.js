const { Client } = require('ssh2');
const fs = require('fs');
const { execSync } = require('child_process');

const host = '192.250.227.18';
const keyPath = 'c:\\temp\\pisairtel-key';
const privateKey = fs.readFileSync(keyPath);

const APP_DIR = '~/pisairtelschools.com';
const DOMAIN_DIR = '~/public_html/Pisairtelschools.com';

const conn = new Client();

const commands = [
  // Step 1: Create app directory structure
  ['Step 1: Create app dir', `mkdir -p ${APP_DIR} && echo "dir ready"`],

  // Step 2: Clone fresh repo
  ['Step 2: Clone repo', `cd ~ && rm -rf syspro-deploy && git clone --depth 1 https://github.com/KachiAlex/syspro.git syspro-deploy 2>&1 | tail -5`],

  // Step 3: Copy files to app dir
  ['Step 3: Copy files', `cp -r ~/syspro-deploy/* ${APP_DIR}/ && cp ~/syspro-deploy/.gitignore ${APP_DIR}/ 2>/dev/null; cp ~/syspro-deploy/tsconfig.json ${APP_DIR}/ 2>/dev/null; cp ~/syspro-deploy/next.config.js ${APP_DIR}/ 2>/dev/null; echo "copied"`],

  // Step 4: Install dependencies
  ['Step 4: npm install', `cd ${APP_DIR} && PATH=/opt/alt/alt-nodejs24/root/bin:$PATH npm install --production=false 2>&1 | tail -10`],

  // Step 5: Create .env
  ['Step 5: Create .env', `cat > ${APP_DIR}/.env << 'ENVEOF'
DATABASE_URL="postgresql://neondb_owner:npg_BIlfNjZg2Ko7@ep-restless-union-ai4sgr7d-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
SESSION_SECRET="pisairtel-erp-production-session-secret-2024"
SUPERADMIN_BOOTSTRAP_KEY="Dabonegareus2660"
NODE_ENV="production"
ENVEOF
echo "env created"`],

  // Step 6: Build Next.js (with memory limit for shared hosting)
  ['Step 6: Build Next.js', `cd ${APP_DIR} && PATH=/opt/alt/alt-nodejs24/root/bin:$PATH NODE_OPTIONS="--max-old-space-size=2048" TAILWIND_DISABLE_LIGHTNINGCSS=1 npx next build 2>&1 | tail -30`],

  // Step 7: Create Passenger-compatible server.js
  ['Step 7: Create server.js', `cat > ${APP_DIR}/server.js << 'SJEOF'
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
echo "server.js created"`],

  // Step 8: Configure .htaccess for Passenger to point to app dir
  ['Step 8: Configure .htaccess', `cat > ${DOMAIN_DIR}/.htaccess << 'HTEOF'
PassengerAppRoot ${APP_DIR.replace('~', '/home/pisairtel')}
PassengerNodePath /opt/alt/alt-nodejs24/root/bin/node
PassengerAppType node
PassengerStartupFile server.js
PassengerFriendlyErrorPages off
RewriteEngine On
RewriteRule ^$ http://127.0.0.1:3000/ [P,L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://127.0.0.1:3000/$1 [P,L]
HTEOF
echo "htaccess created" && cat ${DOMAIN_DIR}/.htaccess`],

  // Step 9: Also create .htaccess in app dir for Passenger
  ['Step 9: App .htaccess', `cat > ${APP_DIR}/.htaccess << 'HTEOF2'
PassengerNodePath /opt/alt/alt-nodejs24/root/bin/node
PassengerAppType node
PassengerStartupFile server.js
PassengerFriendlyErrorPages off
HTEOF2
echo "app htaccess created"`],

  // Step 10: Restart app
  ['Step 10: Restart app', `mkdir -p ${APP_DIR}/tmp && touch ${APP_DIR}/tmp/restart.txt && echo "restart triggered"`],

  // Step 11: Verify
  ['Step 11: Verify build', `ls -la ${APP_DIR}/.next/BUILD_ID ${APP_DIR}/server.js ${APP_DIR}/.env 2>&1 && echo "---BUILD_ID---" && cat ${APP_DIR}/.next/BUILD_ID`],

  // Step 12: Cleanup
  ['Step 12: Cleanup', `rm -rf ~/syspro-deploy && echo "cleaned up"`],
];

conn.on('ready', () => {
  console.log('=== DEPLOYING TO pisairtelschools.com ===\n');

  let idx = 0;
  function runNext() {
    if (idx >= commands.length) {
      console.log('\n=== DEPLOYMENT COMPLETE ===');
      console.log('\nThe app should now be available at https://pisairtelschools.com');
      conn.end();
      return;
    }
    const [label, cmd] = commands[idx++];

    console.log(`\n--- ${label} ---`);
    console.log('Running...');

    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.log(`ERROR: ${err.message}`);
        runNext();
        return;
      }
      let output = '';
      stream.on('data', (d) => { output += d.toString(); });
      stream.on('stderr', (d) => { output += d.toString(); });
      stream.on('close', (code) => {
        console.log(output.trim() || '(no output)');
        if (code !== 0) {
          console.log(`[exit code: ${code}]`);
        }
        runNext();
      });
    });
  }
  runNext();
});

conn.on('error', (err) => {
  console.error('SSH Error:', err.message);
  process.exit(1);
});

conn.connect({
  host,
  port: 22,
  username: 'pisairtel',
  privateKey,
  readyTimeout: 30000,
  keepaliveInterval: 10000,
  keepaliveCountMax: 120,
});
