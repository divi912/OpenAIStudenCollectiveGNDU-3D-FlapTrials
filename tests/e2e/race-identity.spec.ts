import { test, expect } from '@playwright/test';

test('Skyline keeps its compact HUD while keyboard flight clears the first section', async ({ page }) => {
  test.setTimeout(80000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('flap.preferences', JSON.stringify({ quality: 'high', reducedMotion: true, musicVolume: 0 })));
  await page.goto('/?webgl=1');
  await expect(page.locator('body')).toHaveAttribute('data-renderer', 'WebGL2', { timeout: 45000 });
  await page.getByRole('button', { name: 'Practice' }).click();
  await page.getByRole('button', { name: 'Ready to race', exact: true }).click();
  await page.waitForFunction(() => document.body.dataset.intro === 'false');
  await expect(page.locator('.cockpit-flock')).toBeHidden();
  await expect(page.locator('.flight-bindings,.panel-footnote')).toHaveCount(0);
  await expect(page.getByRole('progressbar', { name: 'Course progress' })).toBeVisible();
  // Drive through real keyboard events; diagnostics supply snapshots, never positions.
  await page.evaluate(async () => {
    const path = '/scripts/autopilot.ts'; const { pilot } = await import(path);
    const courses = '/shared/courses.ts'; const { COURSES } = await import(courses);
    const held = new Set<string>();
    const fly = () => {
      const p = (window as any).__flap.practice;
      const command = p && p.status === 'racing' ? pilot(p, COURSES[0], p.simulationTick) : undefined;
      const keys = new Set<string>();
      if (command) {
        if (command.steer) keys.add(command.steer > 0 ? 'KeyD' : 'KeyA');
        if (command.pitch) keys.add(command.pitch > 0 ? 'KeyW' : 'KeyS');
        if (command.roll) keys.add(command.roll > 0 ? 'KeyQ' : 'KeyE');
        if (command.flapPressed) {
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
          window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
        }
      }
      for (const key of held) if (!keys.has(key)) { window.dispatchEvent(new KeyboardEvent('keyup', { code: key, bubbles: true })); held.delete(key); }
      for (const key of keys) if (!held.has(key)) { window.dispatchEvent(new KeyboardEvent('keydown', { code: key, bubbles: true })); held.add(key); }
      if (p && p.status !== 'finished') requestAnimationFrame(fly);
    };
    requestAnimationFrame(fly);
  });
  await page.waitForFunction(() => (window as any).__flap.practice.z > 40, undefined, { timeout: 15000 });
  await page.screenshot({ path: '.cache/skyline-race.png' });
  await page.waitForFunction(() => (window as any).__flap.practice.z > 145, undefined, { timeout: 45000 });
  await page.screenshot({ path: '.cache/skyline-midcourse.png' });
  expect((await page.evaluate(() => (window as any).__flap.practice)).checkpointIndex).toBeGreaterThanOrEqual(1);
  expect(Number(await page.getByRole('progressbar').getAttribute('aria-valuenow'))).toBeGreaterThan(10);
  expect(errors).toEqual([]);
});
