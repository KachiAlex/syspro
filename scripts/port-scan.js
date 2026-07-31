const net = require('net');
const ports = [22, 2222, 2200, 8022, 443, 80];
let done = 0;

ports.forEach(p => {
  const s = net.connect({ host: '192.250.227.18', port: p, timeout: 5000 });
  s.on('connect', () => {
    console.log(`Port ${p}: OPEN`);
    s.destroy();
    done++;
    if (done === ports.length) process.exit();
  });
  s.on('error', (err) => {
    console.log(`Port ${p}: closed/error (${err.code})`);
    done++;
    if (done === ports.length) process.exit();
  });
  s.on('timeout', () => {
    console.log(`Port ${p}: timeout`);
    s.destroy();
    done++;
    if (done === ports.length) process.exit();
  });
});
