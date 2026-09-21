import { test as base, expect } from '@playwright/test';

// Every operation is captured, including operations whose assertion fails.
export const test = base.extend({
  step: async ({ page }, use, testInfo) => {
    let index = 0;
    await use(async (name, action) => {
      const number = ++index;
      await base.step(name, async () => {
        let failed = false;
        try {
          await action();
        } catch (error) {
          failed = true;
          throw error;
        } finally {
          const filename = `step-${String(number).padStart(2, '0')}.png`;
          try {
            const location = testInfo.outputPath(filename);
            await page.screenshot({ path: location, fullPage: true, timeout: 10_000 });
            await testInfo.attach(`${number}: ${name}`, { path: location, contentType: 'image/png' });
          } catch (error) {
            if (!failed) throw error;
            await testInfo.attach('Screenshot error', {
              body: String(error), contentType: 'text/plain',
            });
          }
        }
      });
    });
  },
});
export { expect };
