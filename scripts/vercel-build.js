const { execSync } = require('child_process');

function run(command) {
  execSync(command, { stdio: 'inherit', cwd: process.cwd() });
}

try {
  run('npm install --prefer-offline --no-audit');
  run('npm run build:api');
} catch (error) {
  console.error('Vercel build failed:', error.message);
  process.exit(1);
}
