import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  // Long interaction flows (draw, reload, reopen) on software WebGL at 2560 px need headroom.
  timeout: 60_000,
  // Assertions on a slow software-WebGL page (first tiles, reloads) need more than the 5 s default.
  expect: { timeout: 10_000 },
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
    // 2560×1440 renders ~3.5× the pixels of 1366 on software WebGL: give its long flows more time.
    { name: '2560', timeout: 120_000, use: { ...devices['Desktop Chrome'], viewport: { width: 2560, height: 1440 } } },
  ],
});
