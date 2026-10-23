import { test, expect } from '@playwright/test';

test('solo previews the course and lineup without advancing the race', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?webgl=1');
  await expect(page.locator('body')).toHaveAttribute('data-renderer', 'WebGL2', { timeout: 45000 });
  const clockStart = new Date('2026-10-23T12:00:00Z');
  await page.clock.install({ time: clockStart });
  await page.clock.pauseAt(new Date(clockStart.getTime() + 1000));
  await page.getByRole('button', { name: 'Solo practice' }).click();
  await page.clock.runFor(100);
  await expect(page.locator('#race-intro')).toBeVisible();
  await expect(page.locator('#intro-label')).toHaveText('YOUR NEXT CHALLENGE');
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => (window as any).__flap.practice.z)).toBe(0);
  await page.screenshot({ path: '.cache/intro-course.png' });
  await page.clock.fastForward(4100);
  await expect(page.locator('#intro-label')).toHaveText('MEET THE FLOCK', { timeout: 6000 });
  await expect(page.locator('#intro-roster')).toContainText('YOU');
  expect(await page.evaluate(() => (window as any).__flap.practice.z)).toBe(0);
  await page.screenshot({ path: '.cache/intro-lineup.png' });
  await page.clock.resume();
  await expect(page.locator('#race-intro')).toBeHidden({ timeout: 4000 });
  await expect(page.locator('#hud')).toBeVisible();
  await page.waitForFunction(() => (window as any).__flap.practice.z > 0, { timeout: 6000 });
  expect(errors).toEqual([]);
});
