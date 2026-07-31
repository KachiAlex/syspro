const { Client } = require('ssh2');
const fs = require('fs');

const host = '192.250.227.18';
const keyPath = 'c:\\temp\\pisairtel-key';
const privateKey = fs.readFileSync(keyPath);

const commands = [
  ['server.js content', 'cat ~/pisairtel-erp/server.js'],
  ['nodevenv', 'ls -la ~/nodevenv/'],
  ['nodevenv details', 'ls -la ~/nodevenv/*/ 2>/dev/null | head -20'],
  ['node version in app', 'cat ~/nodevenv/*/etc/noderc 2>/dev/null || echo "no noderc"'],
  ['app config', 'cat ~/pisairtel-erp/.env 2>/dev/null || echo "no .env"'],
  ['public dir', 'ls -la ~/pisairtel-erp/public/'],
  ['tmp dir', 'ls -la ~/pisairtel-erp/tmp/'],
  ['passenger env', 'cat ~/pisairtel-erp/tmp/restart.dir/.env 2>/dev/null || echo "no env"'],
  ['which node (login shell)', 'source ~/.bashrc 2>/dev/null; which node 2>/dev/null || echo "not in path"'],
  ['node alt-18', '/opt/alt/alt-nodejs18/root/bin/node --version'],
  ['npm alt-18', '/opt/alt/alt-nodejs18/root/bin/npm --version'],
];

const conn = new Client();

conn.on('ready', () => {
  console.log('=== CHECKING APP DETAILS ===\n');
  
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) {
      console.log('\n=== DONE ===');
      conn.end();
      return;
    }
    const [label, cmd] = commands[idx++];
    
    conn.exec(cmd, (err, stream) => {
      if (err) { console.log(`--- ${label} ---\nERROR\n`); runNext(); return; }
      let output = '';
      stream.on('data', (d) => { output += d.toString(); });
      stream.on('stderr', (d) => { output += d.toString(); });
      stream.on('close', () => {
        console.log(`--- ${label} ---`);
        console.log(output.trim() || '(no output)');
        console.log('');
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
