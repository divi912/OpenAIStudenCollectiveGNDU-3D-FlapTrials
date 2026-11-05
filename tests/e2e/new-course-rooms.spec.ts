import { test, expect } from '@playwright/test';
import { COURSES } from '../../shared/courses';

test('private rooms synchronize all nine choices and start the final hard course together', async ({ browser }) => {
  test.setTimeout(180000);
  const context = await browser.newContext({ viewport: { width: 960, height: 640 } });
  await context.addInitScript(() => localStorage.setItem('flap.preferences', JSON.stringify({ quality: 'low', musicVolume: 0 })));
  const host = await context.newPage(), guest = await context.newPage();
  const errors: string[] = [];
  for (const page of [host, guest]) page.on('pageerror', error => errors.push(error.message));
  // Compile each software-rendered scene separately before opening the room.
  for (const page of [host, guest]) {
    await page.goto('/?webgl=1');
    await expect(page.locator('body')).toHaveAttribute('data-renderer', 'WebGL2', { timeout: 60000 });
  }
  await host.getByRole('button', { name: 'Create room', exact: true }).click();
  await host.getByLabel('Name', { exact: true }).fill('Host');
  await host.locator('#profile-form').getByRole('button', { name: 'Create private room' }).click();
  await expect(host.getByRole('heading', { name: 'Lobby', exact: true })).toBeVisible();
  const code = await host.evaluate(() => (window as any).__flap.room.code);
  await guest.getByRole('button', { name: 'Join room', exact: true }).click();
  await guest.getByLabel('Name', { exact: true }).fill('Guest');
  await guest.getByLabel('ROOM CODE', { exact: true }).fill(code);
  await guest.locator('#profile-form').getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(host.locator('.player-row')).toHaveCount(2);
  for (const course of COURSES) {
    await host.locator(`.lobby-map[data-course="${course.id}"]`).click();
    for (const page of [host, guest]) await expect(page.locator(`.lobby-map[data-course="${course.id}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(guest.locator(`.lobby-map[data-course="${course.id}"]`)).toBeDisabled();
  }
  await guest.getByRole('button', { name: 'Ready up', exact: true }).click();
  await host.getByRole('button', { name: 'Ready up', exact: true }).click();
  await host.getByRole('button', { name: 'Start the race' }).click();
  await host.getByRole('button', { name: 'Buy Crash Guard for 35 Flap Points' }).click();
  await guest.waitForFunction(() => {
    const f = (window as any).__flap;
    return Object.values(f.room.players).some((p: any) => p.name === 'Host' && p.guardCharges === 1 && p.flapPoints === 65);
  }, undefined, { polling: 50 });
  // The shared deadline may already have closed the shop on a slow renderer.
  for (const page of [host, guest]) await page.locator('[data-action=shop-done]').evaluateAll(buttons => buttons.forEach(button => (button as HTMLButtonElement).click()));
  for (const page of [host, guest]) await page.waitForFunction(() => (window as any).__flap.room?.phase === 'racing', undefined, { timeout: 20000, polling: 50 });
  const states = await Promise.all([host, guest].map(page => page.evaluate(() => ({ room: (window as any).__flap.room, stats: (window as any).__flap.stats }))));
  expect(states[0].room.startTick).toBe(states[1].room.startTick);
  for (const state of states) {
    expect(state.room.courseId).toBe('crown_circuit'); expect(state.stats.courseId).toBe('crown_circuit');
    expect(Object.keys(state.room.players)).toHaveLength(2);
  }
  expect(errors).toEqual([]);
  await context.close();
});
