import { test, expect } from '@playwright/test';

test('landing capacity shows real room counts, throttles refresh and fits a phone', async ({ page }) => {
  let requests = 0;
  await page.route('**/health', route => { requests++; return route.fulfill({ json: { status: 'ok', rooms: 3, players: 17, capacity: { maxRooms: 10, maxPlayersPerRoom: 8, acceptingNewRooms: true, availablePublicSeats: 5 } } }); });
  await page.goto('/?webgl=1');
  await expect(page.locator('#capacity-state')).toHaveText('Multiplayer online');
  await expect(page.locator('#capacity-rooms')).toHaveText('3 / 10');
  await expect(page.locator('#capacity-free')).toHaveText('7');
  await expect(page.locator('#capacity-players')).toHaveText('17');
  await expect(page.locator('#capacity-public')).toContainText('5 open seats');
  await expect(page.locator('#capacity-host')).toBeEnabled();
  await expect(page.locator('#capacity-refresh')).toBeDisabled();
  await page.locator('#capacity-refresh').dispatchEvent('click');
  expect(requests).toBe(1);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('full servers disable new hosting but keep code joins available', async ({ page }) => {
  await page.route('**/health', route => route.fulfill({ json: { status: 'ok', rooms: 10, players: 64, capacity: { maxRooms: 10, maxPlayersPerRoom: 8, acceptingNewRooms: false, availablePublicSeats: 4 } } }));
  await page.goto('/?webgl=1');
  await expect(page.locator('#capacity-state')).toHaveText('New rooms full');
  await expect(page.locator('#capacity-free')).toHaveText('0');
  await expect(page.locator('#capacity-host')).toBeDisabled();
  await page.getByRole('button', { name: 'Join by code', exact: true }).click();
  await expect(page.getByLabel('ROOM CODE')).toBeVisible();
});

test('unreachable servers show an honest unknown capacity and leave solo available', async ({ page }) => {
  await page.route('**/health', route => route.fulfill({ status: 503, body: 'Waking' }));
  await page.goto('/?webgl=1');
  await expect(page.locator('#capacity-state')).toHaveText('Server waking or unavailable');
  await expect(page.locator('#capacity-free')).toHaveText('—');
  await expect(page.getByRole('button', { name: 'Solo practice' })).toBeEnabled();
});
