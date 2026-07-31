const { Client } = require('ssh2');
const fs = require('fs');

const host = '192.250.227.18';
const keyPath = 'c:\\temp\\pisairtel-key';
const privateKey = fs.readFileSync(keyPath);

const conn = new Client();

// Use exec with longer timeout for build
conn.on('ready', () => {
  console.log('=== BUILDING NEXT.JS APP ===\n');
  console.log('This will take several minutes...\n');
  
  // Run build with a stream approach so we see output as it comes
  const buildCmd = 'cd ~/pisairtel-erp && PATH=/opt/alt/alt-nodejs24/root/bin:$PATH NODE_OPTIONS="--max-old-space-size=4096" TAILWIND_DISABLE_LIGHTNINGCSS=1 npx next build 2>&1';
  
  conn.exec(buildCmd, (err, stream) => {
    if (err) { console.error('Error:', err.message); conn.end(); return; }
    
    let output = '';
    stream.on('data', (d) => { 
      const text = d.toString();
      process.stdout.write(text);
      output += text;
    });
    stream.on('stderr', (d) => { 
      const text = d.toString();
      process.stderr.write(text);
      output += text;
    });
    stream.on('close', (code) => {
      console.log(`\n\n=== BUILD EXIT CODE: ${code} ===`);
      
      if (code === 0) {
        // Create server.js
        console.log('\n=== Creating server.js ===');
        const serverJs = `const { createServer } = require('http');
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
});`;
        
        conn.exec(`cat > ~/pisairtel-erp/server.js << 'SJEOF'\n${serverJs}\nSJEOF\necho "server.js created"`, (err2, stream2) => {
          if (err2) { console.error('Error creating server.js:', err2.message); }
          let out2 = '';
          stream2.on('data', (d) => { out2 += d.toString(); });
          stream2.on('close', () => {
            console.log(out2);
            // Restart the app
            console.log('\n=== Restarting app ===');
            conn.exec('mkdir -p ~/pisairtel-erp/tmp && touch ~/pisairtel-erp/tmp/restart.txt && echo "restarted"', (err3, stream3) => {
              if (err3) { console.error('Error restarting:', err3.message); conn.end(); return; }
              let out3 = '';
              stream3.on('data', (d) => { out3 += d.toString(); });
              stream3.on('close', () => {
                console.log(out3);
                // Verify
                console.log('\n=== Verifying ===');
                conn.exec('ls -la ~/pisairtel-erp/.next/BUILD_ID ~/pisairtel-erp/server.js ~/pisairtel-erp/.env', (err4, stream4) => {
                  if (err4) { console.error('Error:', err4.message); conn.end(); return; }
                  let out4 = '';
                  stream4.on('data', (d) => { out4 += d.toString(); });
                  stream4.on('close', () => {
                    console.log(out4);
                    conn.end();
                  });
                });
              });
            });
          });
        });
      } else {
        console.log('\nBuild failed! Check output above.');
        conn.end();
      }
    });
  });
});

conn.on('error', (err) => {
  console.error('SSH Error:', err.message);
});

conn.on('close', () => {
  console.log('\nSSH connection closed.');
});

conn.connect({
  host,
  port: 22,
  username: 'pisairtel',
  privateKey,
  readyTimeout: 60000,
  // Keep alive
  keepaliveInterval: 10000,
  keepaliveCountMax: 60,
});
