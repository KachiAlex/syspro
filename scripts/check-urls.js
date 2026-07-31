const { Client } = require('ssh2');
const fs = require('fs');

const host = '192.250.227.18';
const keyPath = 'c:\\temp\\pisairtel-key';
const privateKey = fs.readFileSync(keyPath);

const conn = new Client();

conn.on('ready', () => {
  const commands = [
    ['App .htaccess', 'cat ~/pisairtel-erp/.htaccess 2>/dev/null || echo "no .htaccess"'],
    ['public_html .htaccess', 'cat ~/public_html/.htaccess 2>/dev/null | head -30'],
    ['public_html contents', 'ls -la ~/public_html/ | head -20'],
    ['App symlink', 'ls -la ~/public_html/pisairtel-erp 2>/dev/null || echo "no symlink"'],
    ['Find app symlinks', 'find ~/public_html -type l -ls 2>/dev/null'],
    ['Passenger config', 'cat ~/pisairtel-erp/.passenger 2>/dev/null || echo "no .passenger"'],
    ['Node app config', 'find ~ -name ".nodeapp" -o -name "passenger*" 2>/dev/null | head -10'],
    ['cPanel app config', 'cat ~/.cpanel/nodeapps 2>/dev/null || echo "no nodeapps file"'],
    ['Check app root', 'ls -la ~/pisairtel-erp/ | head -15'],
  ];
  
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) { conn.end(); return; }
    const [label, cmd] = commands[idx++];
    console.log(`\n--- ${label} ---`);
    conn.exec(cmd, (err, stream) => {
      if (err) { console.log('ERROR'); runNext(); return; }
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

conn.on('error', (err) => { console.error('SSH Error:', err.message); process.exit(1); });
conn.connect({ host, port: 22, username: 'pisairtel', privateKey, readyTimeout: 15000 });
