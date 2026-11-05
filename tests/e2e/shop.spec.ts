import { test, expect } from '@playwright/test';

test('Flap Shop buys real items, preserves savings, supports phones, and starts the race', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('flap.preferences', JSON.stringify({ quality: 'low', musicVolume: 0 })));
  await page.goto('/?webgl=1');
  await expect(page.locator('body')).toHaveAttribute('data-renderer', 'WebGL2', { timeout: 45000 });
  const start = new Date('2026-11-05T19:00:00Z');
  await page.clock.install({ time: start }); await page.clock.pauseAt(new Date(start.getTime() + 1000));
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Flap Shop' })).toBeVisible();
  await expect(page.locator('.shop-wallet strong')).toHaveText('100');
  await expect(page.locator('[data-item=jammer]')).toBeDisabled();
  await page.screenshot({ path: '.cache/shop-desktop.png' });
  await page.getByRole('button', { name: 'Buy Crash Guard for 35 Flap Points' }).click();
  await page.getByRole('button', { name: 'Buy Capacitor for 45 Flap Points' }).click();
  await expect(page.locator('.shop-wallet strong')).toHaveText('20');
  await expect(page.locator('[data-item=overdrive]')).toBeDisabled();
  await expect(page.locator('.shop-status')).toContainText('2 / 2 purchases');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Flap Shop' })).toBeVisible();
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    expect(await page.locator('.shop-screen').evaluate(el => {
      const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth;
    })).toBe(true);
    await page.getByRole('button', { name: 'Ready to race', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Ready to race', exact: true })).toBeInViewport();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.shop-backdrop').evaluate(el => el.scrollTop = 0);
  await page.locator('.shop-screen').screenshot({ path: '.cache/shop-phone.png' });
  await page.getByRole('button', { name: 'Ready to race', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Flap Shop' })).toHaveCount(0);
  await page.clock.fastForward(9300); await page.clock.runFor(100);
  await page.waitForFunction(() => (window as any).__flap.practice.z > 0);
  const racer = await page.evaluate(() => (window as any).__flap.practice);
  expect(racer).toMatchObject({ flapPoints: 20, guardCharges: 1, loadoutMask: 4 });
  await expect(page.locator('#shop-loadout')).toHaveText('Guard · Capacitor');
  await expect(page.locator('#flap-points')).toHaveText('20 FP');
  expect(errors).toEqual([]);
});
