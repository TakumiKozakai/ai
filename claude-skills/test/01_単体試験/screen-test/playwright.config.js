import { defineConfig } from '@playwright/test';
import path from 'node:path';

const output = process.env.EVIDENCE_DIR || path.resolve('test-results');
export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: true,
  outputDir: path.join(output, 'browser'),
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(output, 'playwright-report'), open: 'never' }],
    ['json', { outputFile: path.join(output, 'playwright.json') }],
  ],
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:8080',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 900 },
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
