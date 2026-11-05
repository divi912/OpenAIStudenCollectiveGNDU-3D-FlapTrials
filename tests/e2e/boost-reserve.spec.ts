import { test, expect } from '@playwright/test';

test('manual boost spends stored reserve and has an accessible live meter', async ({ page }) => {
  await page.goto('/?webgl=1');
  await expect(page.locator('body')).toHaveAttribute('data-renderer', 'WebGL2', { timeout: 45000 });
  const start=new Date('2026-11-05T10:00:00Z');
  await page.clock.install({time:start}); await page.clock.pauseAt(new Date(start.getTime()+1000));
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Ready to race', exact: true }).click();
  await page.clock.fastForward(9300); await page.clock.runFor(50);
  await page.waitForFunction(() => (window as any).__flap.practice?.z > 1, undefined, { timeout: 15000 });
  const before = await page.evaluate(() => (window as any).__flap.practice.boostReserve);
  await page.keyboard.down('KeyF');
  await page.clock.runFor(300);
  await page.waitForFunction(() => (window as any).__flap.practice.boostActive);
  await expect(page.locator('.boost-reserve')).toHaveClass(/active/);
  await expect(page.getByRole('meter', { name: 'Stored boost' })).toBeVisible();
  await page.waitForFunction(value => (window as any).__flap.practice.boostReserve < value - 4, before);
  await page.keyboard.up('KeyF');
  await page.clock.runFor(100);
  await page.waitForFunction(() => !(window as any).__flap.practice.boostActive);
  await expect(page.locator('#boost-state')).toHaveText(/Hold F|Recharging/);
  await page.screenshot({ path: '.cache/ink-boost-race.png' });
});

test('boost meter and touch controls fit small phones and landscape', async ({ page }) => {
  await page.goto('/?webgl=1');
  await expect(page.locator('body')).toHaveAttribute('data-renderer', 'WebGL2', { timeout: 45000 });
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Ready to race', exact: true }).click();
  await expect(page.locator('#hud')).toBeVisible({ timeout: 15000 });
  for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    expect(await page.locator('.boost-reserve,.navigation-panel,.cockpit-menu').evaluateAll(nodes => nodes.every(el => {
      const r = el.getBoundingClientRect(); return r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
    }))).toBe(true);
  }
});
