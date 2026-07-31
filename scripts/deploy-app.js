const { Client } = require('ssh2');
const fs = require('fs');

const host = '192.250.227.18';
const keyPath = 'c:\\temp\\pisairtel-key';
const privateKey = fs.readFileSync(keyPath);

const conn = new Client();

// All commands run sequentially - each must complete before next
const commands = [
  // Step 1: Clean up and clone repo
  ['Step 1: Remove old app files', 'cd ~/pisairtel-erp && rm -rf server.js public tmp && ls -la'],
  ['Step 1b: Clone repo', 'cd ~ && git clone https://github.com/KachiAlex/syspro.git pisairtel-erp-src 2>&1 || echo "clone may have failed, checking..." && ls -la ~/pisairtel-erp-src/ 2>/dev/null | head -5'],
  
  // Step 2: Copy files to app directory
  ['Step 2: Copy to app dir', 'cp -r ~/pisairtel-erp-src/* ~/pisairtel-erp/ && cp ~/pisairtel-erp-src/.gitignore ~/pisairtel-erp/ 2>/dev/null; cp ~/pisairtel-erp-src/.eslintrc.json ~/pisairtel-erp/ 2>/dev/null; cp ~/pisairtel-erp-src/tsconfig.json ~/pisairtel-erp/ 2>/dev/null; ls ~/pisairtel-erp/'],
  
  // Step 3: Set up Node.js path and install dependencies
  ['Step 3: Check node version', '/opt/alt/alt-nodejs24/root/bin/node --version'],
  ['Step 3b: Install dependencies', 'cd ~/pisairtel-erp && PATH=/opt/alt/alt-nodejs24/root/bin:$PATH npm install --production=false 2>&1 | tail -20'],
  
  // Step 4: Create .env file
  ['Step 4: Create .env', `cat > ~/pisairtel-erp/.env << 'ENVEOF'
DATABASE_URL="postgresql://neondb_owner:npg_BIlfNjZg2Ko7@ep-restless-union-ai4sgr7d-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
SESSION_SECRET="pisairtel-erp-production-session-secret-2024"
SUPERADMIN_BOOTSTRAP_KEY="Dabonegareus2660"
NODE_ENV="production"
ENVEOF
echo "env created" && cat ~/pisairtel-erp/.env`],
  
  // Step 5: Build the app
  ['Step 5: Build Next.js', 'cd ~/pisairtel-erp && PATH=/opt/alt/alt-nodejs24/root/bin:$PATH NODE_OPTIONS="--max-old-space-size=4096" TAILWIND_DISABLE_LIGHTNINGCSS=1 npx next build 2>&1 | tail -30'],
  
  // Step 6: Create Passenger-compatible server.js
  ['Step 6: Create server.js', `cat > ~/pisairtel-erp/server.js << 'SJEOF'
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
echo "server.js created" && cat ~/pisairtel-erp/server.js`],
  
  // Step 7: Create restart file
  ['Step 7: Restart app', 'mkdir -p ~/pisairtel-erp/tmp && touch ~/pisairtel-erp/tmp/restart.txt && echo "restart triggered"'],
  
  // Step 8: Verify
  ['Step 8: Verify build', 'ls -la ~/pisairtel-erp/.next/ 2>/dev/null | head -10'],
  ['Step 8b: Verify files', 'ls ~/pisairtel-erp/server.js ~/pisairtel-erp/.env ~/pisairtel-erp/.next/BUILD_ID 2>/dev/null'],
];

conn.on('ready', () => {
  console.log('=== DEPLOYING PISAIRTEL ERP ===\n');
  
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) {
      console.log('\n=== DEPLOYMENT COMPLETE ===');
      conn.end();
      return;
    }
    const [label, cmd] = commands[idx++];
    
    console.log(`\n--- ${label} ---`);
    console.log('Running...');
    
    conn.exec(cmd, (err, stream) => {
      if (err) { console.log(`ERROR: ${err.message}`); runNext(); return; }
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
  readyTimeout: 15000,
});
