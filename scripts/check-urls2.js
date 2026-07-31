const { Client } = require('ssh2');
const fs = require('fs');

const host = '192.250.227.18';
const keyPath = 'c:\\temp\\pisairtel-key';
const privateKey = fs.readFileSync(keyPath);

const conn = new Client();

conn.on('ready', () => {
  console.log('=== CHECKING URL CONFIG ===\n');
  
  const commands = [
    ['public_html .htaccess', 'cat ~/public_html/.htaccess 2>/dev/null | head -40'],
    ['public_html contents', 'ls -la ~/public_html/'],
    ['Find symlinks', 'find ~/public_html -type l -ls 2>/dev/null'],
    ['App dir contents', 'ls -la ~/pisairtel-erp/'],
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

conn.on('error', (err) => { console.error('SSH Error:', err.message); process.exit(1); });
conn.on('close', () => { console.log('Connection closed'); });
conn.connect({ host, port: 22, username: 'pisairtel', privateKey, readyTimeout: 15000 });
