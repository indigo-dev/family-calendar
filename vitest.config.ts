import { defineConfig } from 'vitest/config';

// The app runs on German devices; date tests rely on the Berlin wall clock (incl. DST switches).
process.env.TZ = 'Europe/Berlin';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
