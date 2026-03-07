import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  globalTeardown: './e2e/merge-results.ts',
  use: {
    headless: true,
  },
  webServer: [
    {
      command: 'pnpm -C demos/visual dev',
      port: 3003,
      reuseExistingServer: true,
      timeout: 15000,
    },
    {
      command: 'pnpm -C demos/visual-tests dev',
      port: 3010,
      reuseExistingServer: true,
      timeout: 15000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      testMatch: 'port-edge-alignment.spec.ts',
      use: {
        browserName: 'chromium',
        baseURL: 'http://localhost:3003',
      },
    },
    {
      name: 'visual-regression',
      testMatch: 'visual-regression.spec.ts',
      fullyParallel: true,
      use: {
        browserName: 'chromium',
        baseURL: 'http://localhost:3010',
      },
    },
  ],
})
