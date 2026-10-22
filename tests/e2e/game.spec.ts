import { test, expect } from '@playwright/test';

test('renders the reference-inspired home, six open courses, settings and flight lesson', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?webgl=1');
  await expect(page.locator('body')).toHaveAttribute('data-renderer', 'WebGL2', { timeout: 45000 });
  await expect(page.locator('.course-card')).toHaveCount(6);
  await expect(page.getByRole('heading', { name: 'Tiny wings. Big trials.' })).toBeVisible();
  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('heading', { name: 'A little flight school.' })).toBeVisible();
  await page.getByRole('button', { name: "Got it. Let's flap." }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Visual quality')).toBeVisible();
  expect(errors).toEqual([]);
});

test('practice flies, a held key does not auto-flap, crashes respawn, and restart clears state', async ({ page }) => {
  await page.goto('/?webgl=1&debug=1');
  await expect(page.locator('body')).toHaveAttribute('data-renderer', 'WebGL2', { timeout: 45000 });
  await page.getByRole('button', { name: 'Solo practice' }).click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.waitForFunction(() => (window as any).__flap.practice?.z > 1, { timeout: 10000 });
  await page.keyboard.down('Space');
  await page.waitForTimeout(1100);
  const bird = await page.evaluate(() => (window as any).__flap.practice);
  expect(bird.z).toBeGreaterThan(8); expect(bird.vy).toBeLessThan(0);
  await page.keyboard.up('Space');
  await page.waitForFunction(() => (window as any).__flap.practice?.crashCount > 0, { timeout: 10000 });
  await page.keyboard.press('KeyR');
  const restarted = await page.evaluate(() => (window as any).__flap.practice);
  expect(restarted.crashCount).toBe(0); expect(restarted.checkpointIndex).toBe(0); expect(restarted.z).toBe(0);
});

test('two browsers start the same race even when a guest joins before its models finish loading', async ({ browser }) => {
  const context = await browser.newContext();
  const a = await context.newPage(), b = await context.newPage();
  let releaseModels!: () => void;
  const heldModels = new Promise<void>(resolve => { releaseModels = resolve; });
  await b.route('**/models/*.glb', async route => { await heldModels; await route.continue(); });
  await Promise.all([a.goto('/?webgl=1'), b.goto('/?webgl=1')]);
  await expect(a.locator('body')).toHaveAttribute('data-renderer', 'WebGL2', { timeout: 45000 });
  await a.getByRole('button', { name: 'Create a room', exact: true }).click();
  await a.getByLabel('YOUR BIRD NAME').fill('Host Bird');
  await a.getByRole('button', { name: 'Create private room' }).click();
  await expect(a.getByRole('heading', { name: 'The flock is gathering.' })).toBeVisible();
  const code = await a.evaluate(() => (window as any).__flap.room.code);
  await b.getByRole('button', { name: 'Join with a code' }).click();
  await b.getByLabel('YOUR BIRD NAME').fill('Guest Bird'); await b.getByLabel('ROOM CODE').fill(code);
  await b.getByRole('button', { name: 'Join the flock' }).click();
  await expect(b.getByRole('heading', { name: 'The flock is gathering.' })).toBeVisible();
  await expect(a.locator('.player-row')).toHaveCount(2);
  await b.getByRole('button', { name: 'Ready up', exact: true }).click();
  await a.getByRole('button', { name: 'Ready up', exact: true }).click();
  await expect(a.getByRole('button', { name: 'Start the race' })).toBeEnabled();
  await a.getByRole('button', { name: 'Start the race' }).click();
  await b.waitForFunction(() => (window as any).__flap.room?.phase === 'loading');
  expect(await b.evaluate(() => (window as any).__flap.renderer)).toBeUndefined();
  releaseModels();
  for (const page of [a, b]) await page.waitForFunction(() => (window as any).__flap.room?.phase === 'racing', { timeout: 15000 });
  expect(await b.evaluate(() => (window as any).__flap.stats.mode)).toBe('race');
  expect(await b.evaluate(() => (window as any).__flap.stats.courseId)).toBe('skyline_sprint');
  const [first, second] = await Promise.all([a.evaluate(() => (window as any).__flap.room), b.evaluate(() => (window as any).__flap.room)]);
  expect(first.code).toBe(second.code); expect(first.startTick).toBe(second.startTick); expect(Object.keys(first.players)).toHaveLength(2);
  await context.close();
});

test('leaving a closed connection returns immediately instead of hanging the menu', async ({ page }) => {
  test.setTimeout(8000);
  await page.goto('/?webgl=1');
  const result = await page.evaluate(async () => {
    const path = '/client/network/connection.ts'; const { Connection } = await import(path);
    const connection = new Connection();
    await connection.connect('create', 'Closing Bird', '#ffcc42');
    connection.room.reconnection.enabled = false;
    connection.room.connection.close();
    await connection.leave();
    return connection.room === undefined;
  });
  expect(result).toBe(true);
});
