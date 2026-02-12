const { spawnSync } = require('child_process');
const fs = require('fs');

const cmd = process.platform === 'win32' ? 'node' : 'node';
const args = ['node_modules/typescript/bin/tsc', '-p', 'syspro-erp-frontend/tsconfig.json', '--noEmit'];

const res = spawnSync(cmd, args, { encoding: 'utf8' });
const out = (res.stdout || '') + (res.stderr || '');
fs.writeFileSync('tmp-tsc-output.txt', out, 'utf8');
console.log('Wrote tmp-tsc-output.txt; exitCode=', res.status);
process.exit(res.status || 0);
