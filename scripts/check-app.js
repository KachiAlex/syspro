const { Client } = require('ssh2');
const fs = require('fs');

const host = '192.250.227.18';
const keyPath = 'c:\\temp\\pisairtel-key';
const privateKey = fs.readFileSync(keyPath);

const commands = [
  ['Home Dir', 'ls -la ~'],
  ['App Dir', 'ls -la ~/pisairtel-erp 2>/dev/null || echo "not found"'],
  ['Node Version', 'node --version 2>/dev/null || echo "not found"'],
  ['NPM Version', 'npm --version 2>/dev/null || echo "not found"'],
  ['cPanel Node paths', 'ls /opt/alt/alt-nodejs*/root/bin/ 2>/dev/null || ls /usr/local/cpanel/3rdparty/ 2>/dev/null | head -10'],
  ['Find node binaries', 'find /opt -name "node" -type f 2>/dev/null | head -5'],
  ['Passenger file', 'ls -la ~/pisairtel-erp/server.js 2>/dev/null || echo "no server.js"'],
  ['Passenger config', 'cat ~/pisairtel-erp/.passenger 2>/dev/null || echo "no .passenger"'],
  ['NVM check', 'ls -la ~/.nvm 2>/dev/null || echo "no nvm"'],
  ['Git version', 'git --version 2>/dev/null'],
];

const conn = new Client();

conn.on('ready', () => {
  console.log('=== CHECKING CPANEL NODE APP SETUP ===\n');
  
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
