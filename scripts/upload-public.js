const { Client } = require('ssh2');
const fs = require('fs');

const host = '192.250.227.18';
const keyPath = 'c:\\temp\\pisairtel-key';
const privateKey = fs.readFileSync(keyPath);

const conn = new Client();

conn.on('ready', () => {
  console.log('=== UPLOADING PUBLIC FOLDER & CHECKING APP ===\n');
  
  // Step 1: Upload public tar
  console.log('Step 1: Uploading public folder...');
  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP Error:', err.message); conn.end(); return; }
    
    const readStream = fs.createReadStream('c:\\temp\\pisairtel-public.tar');
    const writeStream = sftp.createWriteStream('/home/pisairtel/pisairtel-public.tar');
    
    writeStream.on('close', () => {
      console.log('  Upload complete!');
      extractAndCheck();
    });
    
    writeStream.on('error', (err) => {
      console.error('  Upload error:', err.message);
      conn.end();
    });
    
    readStream.pipe(writeStream);
  });
  
  function extractAndCheck() {
    // Step 2: Extract public
    console.log('Step 2: Extracting public folder...');
    conn.exec('mkdir -p ~/pisairtel-erp/public && cd ~/pisairtel-erp/public && tar xf ~/pisairtel-public.tar 2>&1 && echo "extracted OK" && ls ~/pisairtel-erp/public/', (err, stream) => {
      if (err) { console.error('Error:', err.message); conn.end(); return; }
      let out = '';
      stream.on('data', (d) => { out += d.toString(); });
      stream.on('stderr', (d) => { out += d.toString(); });
      stream.on('close', () => {
        console.log('  ', out.trim());
        
        // Step 3: Restart app
        console.log('Step 3: Restarting app...');
        conn.exec('touch ~/pisairtel-erp/tmp/restart.txt && rm -f ~/pisairtel-public.tar && echo "restarted and cleaned"', (err2, stream2) => {
          if (err2) { console.error('Error:', err2.message); conn.end(); return; }
          let out2 = '';
          stream2.on('data', (d) => { out2 += d.toString(); });
          stream2.on('close', () => {
            console.log('  ', out2.trim());
            
            // Step 4: Check app status
            console.log('Step 4: Checking app logs...');
            conn.exec('cat ~/pisairtel-erp/tmp/restart.txt 2>/dev/null; echo "---"; ls -la ~/pisairtel-erp/tmp/ 2>/dev/null; echo "---"; ls ~/pisairtel-erp/.next/static/ 2>/dev/null; echo "---"; ls ~/pisairtel-erp/public/ 2>/dev/null', (err3, stream3) => {
              if (err3) { console.error('Error:', err3.message); conn.end(); return; }
              let out3 = '';
              stream3.on('data', (d) => { out3 += d.toString(); });
              stream3.on('stderr', (d) => { out3 += d.toString(); });
              stream3.on('close', () => {
                console.log('  ', out3.trim());
                console.log('\n=== DEPLOYMENT COMPLETE ===');
                console.log('\nCheck the app URL in cPanel to see if it loads.');
                conn.end();
              });
            });
          });
        });
      });
    });
  }
});

conn.on('error', (err) => {
  console.error('SSH Error:', err.message);
  process.exit(1);
});

conn.connect({
  host, port: 22, username: 'pisairtel', privateKey, readyTimeout: 15000,
});
