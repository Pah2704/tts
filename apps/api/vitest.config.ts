import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.spec.ts'],
    environment: 'node',
    reporters: ['default'],
    // để tránh flakiness khi chạy CI chậm
    hookTimeout: 20000,
    testTimeout: 20000,
  },
});
