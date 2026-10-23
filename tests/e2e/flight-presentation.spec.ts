import { test, expect } from '@playwright/test';

for (const reducedMotion of [false, true]) {
  test(`chosen name stays above the bird and chase banking respects reduced motion=${reducedMotion}`, async ({ page }) => {
    await page.addInitScript(({ reducedMotion }) => {
      localStorage.setItem('flap.preferences', JSON.stringify({ name: '<Sky Bird>', reducedMotion }));
    }, { reducedMotion });
    await page.goto('/?webgl=1');
    await expect(page.locator('body')).toHaveAttribute('data-renderer', 'WebGL2', { timeout: 45000 });
    const start = new Date('2026-10-23T12:00:00Z');
    await page.clock.install({ time: start });
    await page.clock.pauseAt(new Date(start.getTime() + 1000));
    await page.getByRole('button', { name: 'Solo practice' }).click();
    await page.clock.fastForward(9200);
    const tag = page.locator('.bird-nametag.local');
    await expect(tag).toBeVisible();
    await expect(tag).toHaveText('<Sky Bird>');
    expect(await tag.locator('*').count()).toBe(0);
    await page.keyboard.down('KeyD');
    await page.clock.fastForward(250);
    await page.keyboard.up('KeyD');
    const turning = await page.evaluate(() => (window as any).__flap);
    expect(turning.practice.heading).toBeGreaterThan(0);
    if (reducedMotion) expect(turning.camera.bank).toBe(0);
    else expect(Math.abs(turning.camera.bank)).toBeGreaterThan(.01);
    await page.keyboard.down('KeyQ');
    await page.clock.fastForward(250);
    await page.keyboard.up('KeyQ');
    const rolling = await page.evaluate(() => (window as any).__flap);
    expect(rolling.practice.roll).toBeGreaterThan(.5);
    expect(Math.abs(rolling.camera.bank)).toBeLessThanOrEqual(.28);
    if (reducedMotion) rolling.camera.up.forEach((n: number, i: number) => expect(n).toBeCloseTo(i === 1 ? 1 : 0));
    else {
      expect(rolling.camera.bank).not.toBeCloseTo(turning.camera.bank, 2);
      expect(Math.abs(turning.camera.up[0])).toBeGreaterThan(.01);
      await page.screenshot({ path: '.cache/banked-camera-nametag.png' });
    }
    await expect(tag).toBeVisible();
  });
}

test('name tags render remote names as text, hide offscreen racers and clean up departures', async ({ page }) => {
  await page.goto('/?webgl=1');
  const result = await page.evaluate(async () => {
    const path = '/client/game/nametags.ts';
    const { NameTags } = await import(path);
    const host = document.createElement('div'); document.body.append(host);
    const tags = new NameTags(host);
    const birds = [{ playerId: 'a', name: '<img src=x>', color: '#ffcc42' }, { playerId: 'b', name: 'Guest Bird', color: '#55bce7' }];
    tags.update(birds, () => ({ x: 50, y: 50 }), 'a');
    const names = [...host.children].map(tag => tag.textContent);
    const injected = host.querySelectorAll('img').length;
    tags.update(birds.slice(1), () => undefined, 'a');
    const remaining = host.children.length, hidden = (host.firstElementChild as HTMLElement).hidden;
    tags.update([], () => undefined, 'a');
    const cleaned = host.children.length === 0; host.remove();
    return { names, injected, remaining, hidden, cleaned };
  });
  expect(result).toEqual({ names: ['<img src=x>', 'Guest Bird'], injected: 0, remaining: 1, hidden: true, cleaned: true });
});
