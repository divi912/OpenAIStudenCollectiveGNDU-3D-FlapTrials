import { test, expect } from '@playwright/test';

const tiers = ['Easy', 'Medium', 'Hard'];
const courseIds = ['skyline_sprint', 'cloud_carnival', 'crosswind', 'the_needle', 'clockwork', 'terminal_velocity', 'featherless', 'storm_spiral', 'crown_circuit'];

test('nine courses stay grouped, selectable and usable across screen sizes', async ({ page }) => {
  await page.goto('/?webgl=1');
  await expect(page.locator('body')).toHaveAttribute('data-renderer', 'WebGL2', { timeout: 45000 });
  await expect(page.locator('#server-capacity')).toBeHidden();
  await expect(page.locator('.course-card')).toHaveCount(9);
  expect(await page.locator('.course-card').evaluateAll(cards => cards.map(card => card.getAttribute('data-course')))).toEqual(courseIds);
  for (const tier of tiers) {
    const group = page.getByRole('group', { name: `${tier} courses`, exact: true });
    await expect(group.getByRole('heading', { name: tier, exact: true })).toBeVisible();
    await expect(group.locator('.course-card')).toHaveCount(3);
    for (let stage = 1; stage <= 3; stage++) await expect(group.getByRole('button', { name: new RegExp(`^${tier} ${stage} ·`) })).toBeVisible();
  }
  for (const width of [1440, 768, 390, 360, 320]) {
    await page.setViewportSize({ width, height: width > 800 ? 950 : 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const id of courseIds) {
      const card = page.locator(`.course-card[data-course="${id}"]`);
      await card.click();
      await expect(card).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.course-card[aria-pressed="true"]')).toHaveCount(1);
    }
    await page.locator('.server-details summary').click();
    await expect(page.locator('#server-capacity')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.server-details summary').click();
    await expect(page.locator('#server-capacity')).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `.cache/identity-${width}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: 'Practice' }).click();
  await page.getByRole('button', { name: 'Ready to race', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'race');
  await expect(page.locator('#intro-course')).toHaveText('Crown Circuit');
});

test('room course selection exposes all three stages in every difficulty tier', async ({ page }) => {
  await page.goto('/?webgl=1');
  await expect(page.locator('body')).toHaveAttribute('data-renderer', 'WebGL2', { timeout: 45000 });
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await page.getByLabel('Name').fill('Tier Test Bird');
  await page.getByRole('button', { name: 'Create private room' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Lobby' })).toBeVisible();
  await expect(dialog.locator('.lobby-map')).toHaveCount(9);
  for (const tier of tiers) {
    const group = dialog.getByRole('group', { name: `${tier} courses`, exact: true });
    await expect(group.locator('.lobby-map')).toHaveCount(3);
    for (let stage = 1; stage <= 3; stage++) {
      const map = group.getByRole('button', { name: new RegExp(`^${tier} ${stage} ·`) });
      await map.click();
      await expect(map).toHaveAttribute('aria-pressed', 'true');
    }
  }
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width > 800 ? 950 : 844 });
    await expect(dialog.getByRole('button', { name: 'Hard 3 · Crown Circuit', exact: true })).toBeVisible();
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
