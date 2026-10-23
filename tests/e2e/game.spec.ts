import { test, expect } from '@playwright/test';
import { COURSES, getCourse } from '../../shared/courses';

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
  const browserHashes = await page.evaluate(async () => { const path = '/shared/courses.ts'; const { COURSES, getCourse } = await import(path); return COURSES.map((c: { id: string }) => getCourse(c.id).hash); });
  expect(browserHashes).toEqual(COURSES.map(c => getCourse(c.id).hash));
});

test('practice flies, a held key does not auto-flap, crashes respawn, and restart clears state', async ({ page }) => {
  await page.goto('/?webgl=1&debug=1');
  await expect(page.locator('body')).toHaveAttribute('data-renderer', 'WebGL2', { timeout: 45000 });
  await page.getByRole('button', { name: 'Solo practice' }).click();
  // The pre-race cinematic intentionally hides the HUD for six seconds.
  await expect(page.locator('#hud')).toBeVisible({ timeout: 15000 });
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

test('a practice race announces and applies its first shared party event', async ({ page }) => {
  await page.goto('/?webgl=1');
  await expect(page.locator('body')).toHaveAttribute('data-renderer', 'WebGL2', { timeout: 45000 });
  await page.getByRole('button', { name: 'Solo practice' }).click();
  await expect(page.locator('#party-event')).toContainText('INCOMING CHAOS', { timeout: 23000 });
  await expect(page.locator('#party-event')).toContainText('TURBO FLOCK');
  await expect(page.locator('#party-event')).toContainText('FLOCK-WIDE EVENT', { timeout: 6000 });
  await page.waitForFunction(() => (window as any).__flap.practice.speed > 20, { timeout: 8000 });
  await expect(page.locator('#party-event')).toContainText('TURBO FLOCK');
});

test('pitch and roll keys change real flight state and cockpit panels remain aligned', async ({ page }) => {
  await page.goto('/?webgl=1');
  await expect(page.locator('body')).toHaveAttribute('data-renderer', 'WebGL2', { timeout: 45000 });
  await page.getByRole('button', { name: 'Solo practice' }).click();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport);
    const top = await page.locator('.cockpit-top>.flight-card').evaluateAll(nodes => nodes.map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }));
    expect(top).toHaveLength(3); expect(top[0].y).toBe(top[2].y); expect(top[0].height).toBe(top[2].height); expect(Math.abs(top[0].width - top[2].width)).toBeLessThan(1);
    const bottom = await page.locator('.cockpit-bottom>.flight-card').evaluateAll(nodes => nodes.map(el => el.getBoundingClientRect().height));
    expect(new Set(bottom).size).toBe(1);
    const guidanceBottom = await page.locator('#gate-guidance').evaluate(el => el.getBoundingClientRect().bottom);
    expect(guidanceBottom).toBeLessThan(viewport.height * .48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }
  // Layout work can outlast an unattended flight. Start a fresh attempt for control checks.
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => (window as any).__flap.practice?.z > 1, { timeout: 10000 });
  await page.keyboard.down('KeyQ');
  await page.waitForFunction(() => (window as any).__flap.practice.roll > .6, { timeout: 3000 });
  const rolled = await page.evaluate(() => (window as any).__flap.practice.roll); expect(rolled).toBeGreaterThan(.5);
  await page.keyboard.up('KeyQ'); await page.keyboard.press('Space'); await page.keyboard.down('KeyW');
  await page.waitForFunction(() => (window as any).__flap.practice.pitch > .12, { timeout: 3000 });
  const pitched = await page.evaluate(() => (window as any).__flap.practice.pitch); expect(pitched).toBeGreaterThan(.1);
  await page.keyboard.up('KeyW');
  await expect(page.locator('.telemetry-panel,.attitude-panel,.cockpit-style')).toHaveCount(0);
  await expect(page.locator('#gate-instruction')).not.toBeEmpty();
});

test('the in-game reduced-motion preference suppresses comic stamp animation', async ({ page }) => {
  await page.goto('/?webgl=1');
  await expect(page.locator('body')).toHaveAttribute('data-renderer', 'WebGL2', { timeout: 45000 });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Reduced camera motion').check();
  await expect(page.locator('body')).toHaveAttribute('data-reduced-motion', 'true');
  await page.getByRole('button', { name: 'All set' }).click();
  await page.getByRole('button', { name: 'Solo practice' }).click();
  await expect(page.locator('.comic-stamp')).toBeVisible({ timeout: 12000 });
  // The short-lived cue can be replaced between reads; poll a fresh locator and style together.
  await expect(page.locator('.comic-stamp')).toHaveCSS('animation-name', 'none');
});
