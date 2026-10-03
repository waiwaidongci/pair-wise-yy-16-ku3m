import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    launchOptions: {
      env: {
        LD_LIBRARY_PATH:
          '/tmp/browser-libs/root2/usr/lib/aarch64-linux-gnu:/tmp/browser-libs/root2/lib/aarch64-linux-gnu',
      },
    },
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
    timeout: 60000,
  },
});
