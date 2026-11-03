import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '/src', replacement: path.resolve(__dirname, './src') },
    ],
  },
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 60000,
    fileParallelism: false,
    include: ['src/__tests__/**/*.test.ts'],
  },
});