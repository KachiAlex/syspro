const https = require('https');

const url = 'https://pisairtelschools.com';

const req = https.get(url, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log('Body (first 1000 chars):', body.substring(0, 1000));
  });
});

req.on('error', (err) => {
  console.error('Request error:', err.message);
});

req.setTimeout(15000, () => {
  console.log('Request timed out');
  req.destroy();
});
