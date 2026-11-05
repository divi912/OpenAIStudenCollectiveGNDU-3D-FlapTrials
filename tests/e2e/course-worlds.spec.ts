import { test, expect } from '@playwright/test';
import { COURSES } from '../../shared/courses';

test('all nine worlds render and survive switching between tiers', async ({ page }) => {
  test.setTimeout(100000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('flap.preferences', JSON.stringify({ quality: 'high', reducedMotion: true, musicVolume: 0 })));
  await page.goto('/?webgl=1');
  await expect(page.locator('body')).toHaveAttribute('data-renderer', 'WebGL2', { timeout: 45000 });
  const start = new Date('2026-11-05T08:00:00Z');
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1000));
  for (const course of COURSES) {
    await page.locator(`.course-card[data-course="${course.id}"]`).click();
    await page.getByRole('button', { name: 'Practice' }).click();
    await page.clock.runFor(50);
    await expect(page.locator('#intro-course')).toHaveText(course.name);
    await page.clock.fastForward(9300);
    await page.clock.runFor(50);
    await expect(page.getByRole('progressbar')).toBeVisible();
    const data = await page.evaluate(() => (window as any).__flap);
    expect(data.stats.courseId).toBe(course.id);
    expect(data.stats.meshes).toBeGreaterThan(10);
    expect(data.stats.antialiasing.fxaa).toBe(true);
    expect(data.stats.antialiasing.samples).toBeGreaterThanOrEqual(4);
    expect(await page.locator('.clock-panel').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    expect(data.stats.audience.draws).toBeLessThanOrEqual(6);
    await page.screenshot({ path: `.cache/world-${course.id}.png` });
    await page.getByRole('button', { name: 'Race menu', exact: true }).click();
    await page.getByRole('button', { name: 'Leave this race', exact: true }).click();
    await expect(page.locator('body')).toHaveAttribute('data-view', 'home');
  }
  expect(errors).toEqual([]);
});
