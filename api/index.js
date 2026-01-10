const path = require('path');

// Resolve the built serverless handler emitted by `npm run build:api`
const handlerModule = require(path.join(
  __dirname,
  '..',
  'apps',
  'api',
  'dist',
  'apps',
  'api',
  'src',
  'serverless.js',
));

module.exports = handlerModule.default || handlerModule;
