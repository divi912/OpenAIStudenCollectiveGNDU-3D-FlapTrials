import { test, expect } from '@playwright/test';

test('solid audience birds scale down with quality and survive practice restarts', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?webgl=1');
  await expect(page.locator('body')).toHaveAttribute('data-renderer', 'WebGL2', { timeout: 45000 });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Visual quality').selectOption('high');
  await page.getByRole('button', { name: 'All set' }).click();
  await page.getByRole('button', { name: 'Solo practice' }).click();
  await page.waitForFunction(() => (window as any).__flap.stats.audience.birds > 0);
  const high = await page.evaluate(() => (window as any).__flap.stats.audience);
  expect(high.birds).toBeGreaterThan(300); expect(high.draws).toBeLessThanOrEqual(6);
  await expect(page.locator('.telemetry-panel,.attitude-panel,.cockpit-style')).toHaveCount(0);
  await expect(page.locator('#course-progress')).toBeVisible();
  // Exercise the actual two-badge markup at desktop and narrow HUD sizes.
  for (const width of [1440, 1280, 780]) {
    await page.setViewportSize({ width, height: 900 });
    const overlaps = await page.evaluate(() => {
      // Set both badges and measure in one task, before the live HUD refresh clears them.
      const powers = document.getElementById('power-status')!;
      powers.hidden = false; powers.innerHTML = '<span class="boost-power">ROCKET <b>2.5s</b></span><span class="shield-power">BUBBLE <b>4.0s</b></span>';
      const p = powers.getBoundingClientRect(), n = document.querySelector('.navigation-panel')!.getBoundingClientRect();
      return p.left < n.right && p.right > n.left && p.top < n.bottom && p.bottom > n.top;
    });
    expect(overlaps).toBe(false);
  }
  await page.getByRole('button', { name: 'Race menu' }).click();
  await page.getByLabel('Visual quality').selectOption('low');
  await page.getByRole('button', { name: 'Back to the race' }).click();
  await page.waitForFunction(triangles => (window as any).__flap.stats.audience.triangles < triangles / 2, high.triangles);
  const low = await page.evaluate(() => (window as any).__flap.stats.audience);
  expect(low.birds).toBeGreaterThan(0);
  for (let i = 0; i < 3; i++) await page.keyboard.press('KeyR');
  await page.waitForFunction(() => (window as any).__flap.stats.audience.birds > 0);
  expect((await page.evaluate(() => (window as any).__flap.stats.audience)).birds).toBe(low.birds);
  expect(errors).toEqual([]);
});

test('music unlocks on interaction, mutes independently, persists, and renders an unclipped seamless loop', async ({ page }) => {
  await page.goto('/?webgl=1');
  expect(await page.evaluate(() => (window as any).__flap.audio.state)).toBe('locked');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.waitForFunction(() => (window as any).__flap.audio.musicReady, { timeout: 15000 });
  expect(await page.evaluate(() => (window as any).__flap.audio.musicPlaying)).toBe(true);
  await page.getByLabel('Music volume').evaluate((el: HTMLInputElement) => { el.value = '0'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(await page.evaluate(() => (window as any).__flap.audio.musicPlaying)).toBe(false);
  expect(await page.getByLabel('Sound effects').inputValue()).toBe('0.35');
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Music volume')).toHaveValue('0');
  expect(await page.evaluate(() => (window as any).__flap.audio.musicReady)).toBe(false);
  await page.getByLabel('Music volume').evaluate((el: HTMLInputElement) => { el.value = '.25'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForFunction(() => (window as any).__flap.audio.musicReady, { timeout: 15000 });
  const signal = await page.evaluate(async () => {
    const path = '/client/game/music.ts'; const { renderMusic } = await import(path);
    const buffer: AudioBuffer = await renderMusic();
    let peak = 0, energy = 0, seam = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      seam = Math.max(seam, Math.abs(data[0] - data[data.length - 1]));
      for (const sample of data) { peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
    }
    return { peak, rms: Math.sqrt(energy / (buffer.length * 2)), seam, duration: buffer.duration, bytes: buffer.length * 8 };
  });
  expect(signal.duration).toBeGreaterThan(29); expect(signal.duration).toBeLessThan(30);
  expect(signal.peak).toBeLessThan(.81); expect(signal.rms).toBeGreaterThan(.06);
  expect(signal.seam).toBeLessThan(.02); expect(signal.bytes).toBeLessThan(5_200_000);
});
