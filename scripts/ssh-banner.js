const net = require('net');

const s = net.connect({ host: '192.250.227.18', port: 22, timeout: 5000 });
let data = '';

s.on('connect', () => {
  console.log('Connected to port 22');
});

s.on('data', (d) => {
  data += d.toString();
  // SSH banner is the first line
  if (data.includes('\n')) {
    console.log('SSH Banner:', data.split('\n')[0]);
    s.destroy();
    process.exit(0);
  }
});

s.on('error', (err) => {
  console.log('Error:', err.message);
  process.exit(1);
});

s.on('timeout', () => {
  console.log('Timeout. Data so far:', data);
  s.destroy();
  process.exit(1);
});
