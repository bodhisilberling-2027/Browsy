import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: { 
    headless: false, // set true for CI
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    video: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  timeout: 60000,
  testDir: './tests',
  workers: 1 // Prevent parallel execution conflicts
});
