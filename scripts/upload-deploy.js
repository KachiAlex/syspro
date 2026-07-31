const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const host = '192.250.227.18';
const keyPath = 'c:\\temp\\pisairtel-key';
const privateKey = fs.readFileSync(keyPath);
const tarPath = 'c:\\temp\\pisairtel-deploy.tar';

const conn = new Client();

conn.on('ready', () => {
  console.log('=== UPLOADING AND DEPLOYING ===\n');
  
  // Step 1: Clean the app directory
  console.log('Step 1: Cleaning app directory...');
  conn.exec('rm -rf ~/pisairtel-erp/* ~/pisairtel-erp/.* 2>/dev/null; mkdir -p ~/pisairtel-erp', (err, stream) => {
    if (err) { console.error('Error:', err.message); conn.end(); return; }
    let out = '';
    stream.on('data', (d) => { out += d.toString(); });
    stream.on('stderr', (d) => { out += d.toString(); });
    stream.on('close', () => {
      console.log('Cleaned:', out.trim() || 'OK');
      uploadFile();
    });
  });
  
  function uploadFile() {
    // Step 2: Upload tar file via SFTP
    console.log('Step 2: Uploading tar file (48 MB)...');
    conn.sftp((err, sftp) => {
      if (err) { console.error('SFTP Error:', err.message); conn.end(); return; }
      
      const remotePath = '/home/pisairtel/pisairtel-deploy.tar';
      const readStream = fs.createReadStream(tarPath);
      const writeStream = sftp.createWriteStream(remotePath);
      
      let uploaded = 0;
      const total = fs.statSync(tarPath).size;
      
      readStream.on('data', (chunk) => {
        uploaded += chunk.length;
        const pct = Math.round((uploaded / total) * 100);
        process.stdout.write(`\r  Uploaded: ${pct}% (${Math.round(uploaded/1024/1024)}MB / ${Math.round(total/1024/1024)}MB)`);
      });
      
      writeStream.on('close', () => {
        console.log('\n  Upload complete!');
        extractAndConfigure();
      });
      
      writeStream.on('error', (err) => {
        console.error('\n  Upload error:', err.message);
        conn.end();
      });
      
      readStream.pipe(writeStream);
    });
  }
  
  function extractAndConfigure() {
    // Step 3: Extract tar
    console.log('Step 3: Extracting tar...');
    conn.exec('cd ~/pisairtel-erp && tar xf ~/pisairtel-deploy.tar 2>&1 && echo "extracted OK"', (err, stream) => {
      if (err) { console.error('Error:', err.message); conn.end(); return; }
      let out = '';
      stream.on('data', (d) => { out += d.toString(); });
      stream.on('stderr', (d) => { out += d.toString(); });
      stream.on('close', () => {
        console.log('  ', out.trim());
        createEnv();
      });
    });
  }
  
  function createEnv() {
    // Step 4: Create .env file
    console.log('Step 4: Creating .env...');
    const envContent = `DATABASE_URL="postgresql://neondb_owner:npg_BIlfNjZg2Ko7@ep-restless-union-ai4sgr7d-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
SESSION_SECRET="pisairtel-erp-production-session-secret-2024"
SUPERADMIN_BOOTSTRAP_KEY="Dabonegareus2660"
NODE_ENV="production"`;
    
    conn.exec(`cat > ~/pisairtel-erp/.env << 'ENVEOF'\n${envContent}\nENVEOF\necho "env created"`, (err, stream) => {
      if (err) { console.error('Error:', err.message); conn.end(); return; }
      let out = '';
      stream.on('data', (d) => { out += d.toString(); });
      stream.on('close', () => {
        console.log('  ', out.trim());
        verifyAndRestart();
      });
    });
  }
  
  function verifyAndRestart() {
    // Step 5: Verify files
    console.log('Step 5: Verifying files...');
    conn.exec('ls -la ~/pisairtel-erp/server.js ~/pisairtel-erp/.env ~/pisairtel-erp/.next/BUILD_ID ~/pisairtel-erp/.next/static/ 2>&1 && echo "---" && ls ~/pisairtel-erp/ 2>&1', (err, stream) => {
      if (err) { console.error('Error:', err.message); conn.end(); return; }
      let out = '';
      stream.on('data', (d) => { out += d.toString(); });
      stream.on('stderr', (d) => { out += d.toString(); });
      stream.on('close', () => {
        console.log('  ', out.trim());
        
        // Step 6: Restart the app
        console.log('Step 6: Restarting app...');
        conn.exec('mkdir -p ~/pisairtel-erp/tmp && touch ~/pisairtel-erp/tmp/restart.txt && echo "restarted OK" && rm -f ~/pisairtel-deploy.tar && echo "cleanup done"', (err2, stream2) => {
          if (err2) { console.error('Error:', err2.message); conn.end(); return; }
          let out2 = '';
          stream2.on('data', (d) => { out2 += d.toString(); });
          stream2.on('close', () => {
            console.log('  ', out2.trim());
            console.log('\n=== DEPLOYMENT COMPLETE ===');
            conn.end();
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
  host,
  port: 22,
  username: 'pisairtel',
  privateKey,
  readyTimeout: 30000,
  keepaliveInterval: 10000,
  keepaliveCountMax: 60,
});
