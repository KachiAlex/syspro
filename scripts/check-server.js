const { Client } = require('ssh2');
const fs = require('fs');

const host = '192.250.227.18';
const keyPath = 'c:\\temp\\pisairtel-key';
const password = '234@45&$@9+2WHQG';
const privateKey = fs.existsSync(keyPath) ? fs.readFileSync(keyPath) : undefined;

const attempts = [
  { username: 'pisairtel', password: undefined, privateKey },
];

let attemptIdx = 0;

const commands = [
  ['Hostname', 'hostname'],
  ['OS', 'cat /etc/os-release 2>/dev/null | head -5'],
  ['Kernel', 'uname -r'],
  ['Architecture', 'uname -m'],
  ['CPU Info', 'lscpu | grep -E "Model name|CPU\\(s\\)|Thread|Core|Socket" | head -6'],
  ['CPU Usage', "top -bn1 | grep 'Cpu(s)' | head -1"],
  ['Memory', 'free -h'],
  ['Disk Space', 'df -h / /home 2>/dev/null || df -h /'],
  ['Disk Partitions', 'lsblk 2>/dev/null || echo "lsblk not available"'],
  ['Network', 'ip addr show | grep -E "inet |state" | head -10'],
  ['Uptime', 'uptime'],
  ['Installed Software', 'for cmd in nginx docker docker-compose node npm python3 postgres psql redis-cli git curl wget pm2; do printf "%-15s " "$cmd"; which $cmd 2>/dev/null || echo "NOT FOUND"; done'],
  ['Docker', 'systemctl is-active docker 2>/dev/null || echo "not running"'],
  ['Nginx', 'systemctl is-active nginx 2>/dev/null || echo "not running"'],
  ['PostgreSQL', 'systemctl is-active postgresql 2>/dev/null || echo "not running"'],
  ['Node', 'node --version 2>/dev/null || echo "not installed"'],
  ['NPM', 'npm --version 2>/dev/null || echo "not installed"'],
  ['PM2', 'pm2 list 2>/dev/null || echo "not installed"'],
  ['Open Ports', 'ss -tlnp 2>/dev/null | head -20'],
  ['Firewall', 'ufw status 2>/dev/null || echo "ufw not available"'],
  ['Swap', 'swapon --show 2>/dev/null || echo "no swap"'],
  ['Home Dir', 'ls -la ~ 2>/dev/null | head -15'],
  ['Web Root', 'ls -la /var/www 2>/dev/null || echo "no /var/www"'],
  ['Current User', 'whoami && id'],
  ['SSH Config', 'cat /etc/ssh/sshd_config 2>/dev/null | grep -E "PasswordAuthentication|PermitRootLogin|Port" | head -5'],
  ['SSH Users', 'cat /etc/passwd | grep -E "bash|sh$" | cut -d: -f1 | head -10'],
];

function tryConnect() {
  if (attemptIdx >= attempts.length) {
    console.error('All connection attempts failed.');
    process.exit(1);
  }
  
  const attempt = attempts[attemptIdx++];
  console.log(`Trying ${attempt.username} with ${attempt.password ? 'password' : 'key'}...`);
  
  const conn = new Client();

conn.on('ready', () => {
  console.log(`\n=== CONNECTED as ${attempt.username} ===`);
  console.log('=== SERVER INSPECTION REPORT ===\n');
  
  let idx = 0;
  function runNext() {
    if (idx >= commands.length) {
      console.log('\n=== END OF REPORT ===');
      conn.end();
      process.exit(0);
    }
    const [label, cmd] = commands[idx++];
    
    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.log(`--- ${label} ---\nERROR: ${err.message}\n`);
        runNext();
        return;
      }
      let output = '';
      stream.on('data', (data) => { output += data.toString(); });
      stream.on('stderr', (data) => { output += data.toString(); });
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
    console.log(`Failed: ${err.message}`);
    conn.end();
    tryConnect();
  });
  
  const connectOpts = {
    host,
    port: 22,
    username: attempt.username,
    readyTimeout: 15000,
    tryKeyboard: true,
  };
  if (attempt.password) {
    connectOpts.password = attempt.password;
    connectOpts.keyboardInteractive = (name, instructions, lang, prompts, finish) => {
      finish([attempt.password]);
    };
  }
  if (attempt.privateKey) connectOpts.privateKey = attempt.privateKey;
  
  conn.connect(connectOpts);
}

tryConnect();
