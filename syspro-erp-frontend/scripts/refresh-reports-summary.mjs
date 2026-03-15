#!/usr/bin/env node
// POST to the refresh endpoint using REPORTS_REFRESH_TOKEN
// Usage: REPORTS_REFRESH_TOKEN=secret REPORTS_REFRESH_ENDPOINT=http://localhost:3000/api/reports/summary/refresh node scripts/refresh-reports-summary.mjs

import { request } from 'node:http';

const endpoint = process.env.REPORTS_REFRESH_ENDPOINT || 'http://localhost:3000/api/reports/summary/refresh';
const token = process.env.REPORTS_REFRESH_TOKEN;

if (!token) {
  console.error('REPORTS_REFRESH_TOKEN is not set. Aborting.');
  process.exit(2);
}

function post(url, token) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const opts = {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname + (u.search || ''),
        method: 'POST',
        headers: {
          'x-internal-refresh-token': token,
          'content-length': 0,
        },
      };
      const req = request(opts, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode, body });
        });
      });
      req.on('error', reject);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

(async function main(){
  try {
    console.log('Refreshing reports summary via', endpoint);
    const res = await post(endpoint, token);
    console.log('Response status:', res.status);
    console.log('Body:', res.body);
    if (res.status >= 200 && res.status < 300) process.exit(0);
    process.exit(1);
  } catch (e) {
    console.error('Request failed', e);
    process.exit(2);
  }
})();
