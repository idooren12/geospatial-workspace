import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  // Long interaction flows (draw, reload, reopen) on software WebGL at 2560 px need headroom.
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    // Lets sandboxed environments use a preinstalled Chromium; CI uses Playwright's own.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true },
  projects: [
    { name: '1366', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
    { name: '1920', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } },
    { name: '2560', use: { ...devices['Desktop Chrome'], viewport: { width: 2560, height: 1440 } } },
  ],
});
