const { Client } = require('ssh2');
const fs = require('fs');

const host = '192.250.227.18';
const keyPath = 'c:\\temp\\pisairtel-key';
const privateKey = fs.readFileSync(keyPath);

const conn = new Client();

conn.on('ready', () => {
  console.log('=== FIXING STATIC FILES ===\n');
  
  const commands = [
    ['Check current structure', 'ls -la ~/pisairtel-erp/ && echo "---" && ls ~/pisairtel-erp/static/ 2>/dev/null | head -5 && echo "---" && ls ~/pisairtel-erp/.next/ 2>/dev/null'],
    ['Move static to .next/static', 'mv ~/pisairtel-erp/static ~/pisairtel-erp/.next/static 2>/dev/null && echo "moved OK" || echo "move failed, trying cp" && cp -r ~/pisairtel-erp/static ~/pisairtel-erp/.next/static 2>/dev/null && echo "copied OK"'],
    ['Check public dir', 'ls ~/pisairtel-erp/public/ 2>/dev/null || echo "no public dir"'],
    ['Verify .next/static', 'ls ~/pisairtel-erp/.next/static/ 2>/dev/null | head -10'],
    ['Restart app', 'touch ~/pisairtel-erp/tmp/restart.txt && echo "restarted"'],
    ['Check server.js', 'cat ~/pisairtel-erp/server.js'],
  ];
  
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) {
      console.log('\n=== DONE ===');
      conn.end();
      return;
    }
    const [label, cmd] = commands[idx++];
    console.log(`\n--- ${label} ---`);
    conn.exec(cmd, (err, stream) => {
      if (err) { console.log('ERROR:', err.message); runNext(); return; }
      let out = '';
      stream.on('data', (d) => { out += d.toString(); });
      stream.on('stderr', (d) => { out += d.toString(); });
      stream.on('close', () => {
        console.log(out.trim() || '(no output)');
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
  host, port: 22, username: 'pisairtel', privateKey, readyTimeout: 15000,
});
