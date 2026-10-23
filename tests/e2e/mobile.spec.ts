import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('phone flight uses multiple fingers, releases cancelled touches, and fits rotation', async ({ page, context }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?webgl=1');
  await expect(page.locator('body')).toHaveAttribute('data-renderer', 'WebGL2', { timeout: 45000 });
  await page.getByRole('button', { name: 'Flight school' }).click();
  await expect(page.getByRole('heading', { name: 'Touch flight school.' })).toBeVisible();
  await page.getByRole('button', { name: 'Ready to flap' }).click();
  await page.getByRole('button', { name: 'Solo practice', exact: true }).click();
  await expect(page.locator('.touch-controls')).toBeVisible({ timeout: 20000 });
  const session = await context.newCDPSession(page);
  const point = async (name: string) => {
    const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
    { ...await point('Turn left'), id: 1 }, { ...await point('Flap'), id: 2 },
  ] });
  await page.waitForFunction(() => (window as any).__flap.practice.heading < -.05);
  await expect(page.locator('.touch-key.pressed')).toHaveCount(2);
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(page.locator('.touch-key.pressed')).toHaveCount(0);
  for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    await expect.poll(() => page.locator('canvas').evaluate(el => [el.clientWidth, el.clientHeight])).toEqual([size.width, size.height]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    const outside = await page.locator('.touch-key,.cockpit-menu').evaluateAll(nodes => nodes.some(el => {
      const r = el.getBoundingClientRect(); return r.x < 0 || r.y < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1;
    }));
    expect(outside).toBe(false);
  }
  await page.getByRole('button', { name: 'Race menu', exact: true }).tap();
  await expect(page.locator('.touch-controls')).toBeHidden();
  await page.getByRole('button', { name: 'Restart practice' }).tap();
  expect(errors).toEqual([]);
});
