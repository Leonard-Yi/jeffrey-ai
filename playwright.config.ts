import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/specs',
  timeout: 90000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:30081',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // WORKAROUND: Playwright 1.59.1 needs chromium_headless_shell-1217 but only
    // chromium_headless_shell-1208 is installed. Use full chromium-1217 instead.
    launchOptions: {
      executablePath: 'C:\\Users\\leona\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:30081',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
