#!/usr/bin/env node
const path = require('path');
const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/run-migrations-with-url.js <DATABASE_URL>');
  process.exit(1);
}
process.env.DATABASE_URL = url;
require(path.join(__dirname, 'run-migrations.js'));
